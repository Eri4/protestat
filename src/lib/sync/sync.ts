// Optional group sync: every phone in the group uploads what it has (encrypted) and downloads what
// the others uploaded. Nothing is lost when leaving a group or when the server closes: everything
// received is already stored on the phone like any imported report.

import { db, getSetting, setSetting, type ProtestatDB } from '../store/db';
import { httpGet, httpPostJson } from '../engine/fetcher';
import { createBundle, type SharedSource } from '../share/bundle';
import { importBundle } from '../share/io';
import { getKeys } from '../share/keys';
import { groupId, open, seal, type GroupInfo } from './group';

export interface SyncState extends GroupInfo {
  /** 'host' when this phone runs the server. Then it talks to itself on 127.0.0.1. */
  role: 'member' | 'host';
  /** Address this phone uses to reach the server (for a host: http://127.0.0.1:8787). */
  connectUrl: string;
  cursor: number;
  lastPushAt: string;
  lastSyncAt?: string;
  lastError?: string;
  sent: number;
  received: number;
  /** Blob sequence numbers this phone uploaded (skipped when downloading). */
  posted: number[];
  /** Sources other members use, offered to the user (never added silently). */
  suggested: SharedSource[];
  joinedAt: string;
}

const KEY = 'syncGroup';

export async function getGroup(target: ProtestatDB = db): Promise<SyncState | null> {
  return getSetting<SyncState | null>(KEY, null, target);
}

async function saveGroup(s: SyncState | null, target: ProtestatDB = db) {
  await setSetting(KEY, s, target);
}

export async function testServer(url: string): Promise<boolean> {
  try {
    const r = await httpGet(`${url}/v1/health`, { allowLan: true, timeoutMs: 8000 });
    return r.status === 200 && JSON.parse(r.body)?.app === 'protestat-relay';
  } catch {
    return false;
  }
}

export async function joinGroup(g: GroupInfo, opts: { role?: 'member' | 'host'; connectUrl?: string } = {}, target: ProtestatDB = db): Promise<SyncState> {
  const s: SyncState = {
    ...g,
    role: opts.role ?? 'member',
    connectUrl: opts.connectUrl ?? g.server,
    cursor: 0,
    // Share what this phone collected in the last 12 hours when joining.
    lastPushAt: new Date(Date.now() - 12 * 3600e3).toISOString(),
    sent: 0,
    received: 0,
    posted: [],
    suggested: [],
    joinedAt: new Date().toISOString(),
  };
  await saveGroup(s, target);
  return s;
}

/** Leaves the group. Everything already received stays on the phone. */
export async function leaveGroup(target: ProtestatDB = db): Promise<void> {
  await saveGroup(null, target);
}

export async function dismissSuggestion(url: string, target: ProtestatDB = db): Promise<void> {
  const s = await getGroup(target);
  if (!s) return;
  s.suggested = s.suggested.filter((x) => x.url !== url);
  await saveGroup(s, target);
}

let running: Promise<SyncState | null> | null = null;

/** Uploads new data from this phone, then downloads what the others shared. */
export function syncNow(target: ProtestatDB = db): Promise<SyncState | null> {
  if (running) return running;
  running = (async () => {
    const s = await getGroup(target);
    if (!s) return null;
    const base = `${s.connectUrl}/v1/g/${await groupId(s.key)}/blobs`;
    try {
      // ---- upload: reports this phone collected or made itself (not ones it received) ----
      const now = new Date().toISOString();
      const fresh = (await target.reports.where('collectedAt').above(s.lastPushAt).toArray())
        .filter((r) => r.provenance.origin !== 'imported')
        .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))
        .slice(0, 400);
      if (fresh.length) {
        const sources = await target.sources.toArray();
        const bundle = await createBundle(fresh, sources, await getKeys(target));
        // The bundle is already compressed and signed; encrypt it for the group.
        const blob = await seal(s.key, bundle);
        const r = await httpPostJson(base, blob, { allowLan: true });
        if (r.status !== 201) throw new Error(`upload-${r.status}`);
        s.posted = [...s.posted, JSON.parse(r.body).seq].slice(-300);
        s.sent += fresh.length;
      }
      s.lastPushAt = now;

      // ---- download ----
      for (let page = 0; page < 10; page++) {
        const r = await httpGet(`${base}?after=${s.cursor}`, { allowLan: true, timeoutMs: 20000 });
        if (r.status !== 200) throw new Error(`download-${r.status}`);
        const { items, next } = JSON.parse(r.body) as { items: { seq: number; iv: string; data: string }[]; next: number };
        for (const it of items) {
          if (s.posted.includes(it.seq)) continue;
          try {
            // Decrypt, then the same checks as a received file: size, format, signatures.
            const summary = await importBundle(await open(s.key, it), target);
            s.received += summary.added;
            for (const src of summary.suggestedSources)
              if (!s.suggested.some((x) => x.url === src.url)) s.suggested.push(src);
          } catch {
            /* wrong key, damaged or malicious blob: skipped, never stored */
          }
        }
        s.cursor = Math.max(s.cursor, next);
        if (items.length < 100) break;
      }
      s.lastSyncAt = new Date().toISOString();
      s.lastError = undefined;
    } catch (e) {
      s.lastError = e instanceof Error ? e.message : 'error';
    }
    await saveGroup(s, target);
    return s;
  })().finally(() => {
    running = null;
  });
  return running;
}

