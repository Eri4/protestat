#!/usr/bin/env node
// Protestat relay — an optional mailbox that lets a group of phones share reports.
//
// It stores only encrypted blobs: the group key never reaches the server, so whoever runs it
// cannot read what is shared. It needs no database and no dependencies (Node.js 18+).
//
//   node relay.mjs                 # listens on port 8787, keeps data in ./data
//   PORT=9000 TTL_HOURS=24 node relay.mjs
//
// Protocol (v1) — the Android app's built-in "host on this phone" server implements the same:
//   GET  /v1/health                         -> { ok, app, version, ttlHours }
//   POST /v1/g/<group>/blobs  {iv, data}    -> 201 { seq }
//   GET  /v1/g/<group>/blobs?after=N        -> { items: [{ seq, t, iv, data }], next }
// <group> is a random id derived from the group key (16-64 chars of A-Z a-z 0-9 _ -).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR ?? './data';
const TTL_MS = Number(process.env.TTL_HOURS ?? 72) * 3600e3;
const MAX_ITEMS = Number(process.env.MAX_GROUP_ITEMS ?? 2000);
const MAX_GROUPS = Number(process.env.MAX_GROUPS ?? 2000);
const MAX_BODY = 1_500_000;
const PAGE = 100;
const POSTS_PER_MIN = Number(process.env.POSTS_PER_MIN ?? 120);
const GROUP_RE = /^[A-Za-z0-9_-]{16,64}$/;
const B64_RE = /^[A-Za-z0-9+/=_-]+$/;

/** @type {Map<string, {seq: number, items: {seq: number, t: number, iv: string, data: string}[]}>} */
let groups = new Map();
let dirty = false;
const file = path.join(DATA_DIR, 'relay.json');

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    groups = new Map(Object.entries(raw));
  } catch {
    groups = new Map();
  }
}

function save() {
  if (!dirty) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(groups)));
  fs.renameSync(tmp, file);
  dirty = false;
}

function prune(now = Date.now()) {
  for (const [id, g] of groups) {
    const before = g.items.length;
    g.items = g.items.filter((it) => now - it.t < TTL_MS);
    if (g.items.length > MAX_ITEMS) g.items = g.items.slice(-MAX_ITEMS);
    if (!g.items.length) groups.delete(id);
    if (g.items.length !== before) dirty = true;
  }
}

const hits = new Map();
function rateLimited(ip) {
  const minute = Math.floor(Date.now() / 60e3);
  const key = `${ip}|${minute}`;
  const n = (hits.get(key) ?? 0) + 1;
  hits.set(key, n);
  if (hits.size > 10000) for (const k of hits.keys()) if (!k.endsWith(`|${minute}`)) hits.delete(k);
  return n > POSTS_PER_MIN;
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('too-big'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createRelay() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://relay');
      if (req.method === 'OPTIONS') return send(res, 204);
      if (req.method === 'GET' && url.pathname === '/v1/health')
        return send(res, 200, { ok: true, app: 'protestat-relay', version: 1, ttlHours: TTL_MS / 3600e3 });

      const m = url.pathname.match(/^\/v1\/g\/([^/]+)\/blobs$/);
      if (!m || !GROUP_RE.test(m[1])) return send(res, 404, { error: 'not-found' });
      const gid = m[1];

      if (req.method === 'GET') {
        const after = Math.max(0, Number(url.searchParams.get('after') ?? 0) || 0);
        const g = groups.get(gid);
        const items = g ? g.items.filter((it) => it.seq > after).slice(0, PAGE) : [];
        return send(res, 200, { items, next: items.length ? items[items.length - 1].seq : after });
      }

      if (req.method === 'POST') {
        // No proxy headers are trusted: behind a reverse proxy all clients share one limit bucket.
        if (rateLimited(req.socket.remoteAddress ?? '?')) return send(res, 429, { error: 'slow-down' });
        let body;
        try {
          body = JSON.parse(await readBody(req));
        } catch (e) {
          return send(res, e instanceof Error && e.message === 'too-big' ? 413 : 400, { error: 'bad-body' });
        }
        const { iv, data } = body ?? {};
        if (typeof iv !== 'string' || typeof data !== 'string' || iv.length > 64 || !B64_RE.test(iv) || !B64_RE.test(data))
          return send(res, 400, { error: 'bad-body' });
        let g = groups.get(gid);
        if (!g) {
          if (groups.size >= MAX_GROUPS) return send(res, 507, { error: 'full' });
          g = { seq: 0, items: [] };
          groups.set(gid, g);
        }
        g.seq += 1;
        g.items.push({ seq: g.seq, t: Date.now(), iv, data });
        if (g.items.length > MAX_ITEMS) g.items.shift();
        dirty = true;
        return send(res, 201, { seq: g.seq });
      }
      return send(res, 405, { error: 'method' });
    } catch {
      return send(res, 500, { error: 'server' });
    }
  });
}

// Run as a program (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('relay.mjs')) {
  load();
  prune();
  const server = createRelay();
  server.listen(PORT, HOST, () => console.log(`Protestat relay listening on http://${HOST}:${PORT} (data: ${path.resolve(DATA_DIR)})`));
  setInterval(() => {
    prune();
    save();
  }, 10_000).unref();
  const stop = () => {
    save();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
