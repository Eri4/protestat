// Conformance tests for the relay protocol, run against BOTH servers:
// the VPS server (server/relay.mjs) and the phone server (RelayServer.java).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '..');
const GID = 'testgroup_0123456789abcdef';

function waitFor(child: ChildProcess, pattern: RegExp): Promise<void> {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('server did not start')), 15000);
    const on = (d: Buffer) => {
      if (pattern.test(d.toString())) {
        clearTimeout(timer);
        res();
      }
    };
    child.stdout?.on('data', on);
    child.stderr?.on('data', on);
    child.on('exit', (c) => rej(new Error(`exited ${c}`)));
  });
}

interface Target {
  name: string;
  start(port: number, dir: string): ChildProcess | null;
  ready: RegExp;
}

const javaHome = process.env.JAVA_HOME;
const javac = javaHome && existsSync(join(javaHome, 'bin', 'javac')) ? join(javaHome, 'bin', 'javac') : 'javac';
const java = javaHome && existsSync(join(javaHome, 'bin', 'java')) ? join(javaHome, 'bin', 'java') : 'java';
const hasJava = spawnSync(javac, ['-version']).status === 0;

const targets: Target[] = [
  {
    name: 'VPS server (Node)',
    ready: /listening/,
    start: (port, dir) =>
      spawn(process.execPath, [join(root, 'server', 'relay.mjs')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, POSTS_PER_MIN: '10000' } }),
  },
  {
    name: 'phone server (Java)',
    ready: /listening/,
    start: (port, dir) => {
      if (!hasJava) return null;
      const out = join(dir, 'classes');
      const src = join(root, 'android/app/src/main/java/al/protestat/app/relay/RelayServer.java');
      const c = spawnSync(javac, ['-d', out, src]);
      if (c.status !== 0) throw new Error(c.stderr.toString());
      return spawn(java, ['-cp', out, 'al.protestat.app.relay.RelayServer', String(port), join(dir, 'relay.tsv')]);
    },
  },
];

let portBase = 18700 + Math.floor(Math.random() * 500);

for (const target of targets) {
  describe(target.name, () => {
    let child: ChildProcess | null = null;
    let base = '';
    beforeAll(async () => {
      const port = portBase++;
      const dir = mkdtempSync(join(tmpdir(), 'relay-'));
      child = target.start(port, dir);
      if (!child) return;
      await waitFor(child, target.ready);
      base = `http://127.0.0.1:${port}`;
    }, 30000);
    afterAll(() => {
      child?.kill();
    });
    const skip = () => !child;

    it('answers health with CORS headers', async () => {
      if (skip()) return;
      const r = await fetch(`${base}/v1/health`);
      expect(r.status).toBe(200);
      expect(r.headers.get('access-control-allow-origin')).toBe('*');
      expect(await r.json()).toMatchObject({ ok: true, app: 'protestat-relay', version: 1 });
    });
    it('stores blobs and returns them in order after a cursor', async () => {
      if (skip()) return;
      for (let i = 1; i <= 3; i++) {
        const r = await fetch(`${base}/v1/g/${GID}/blobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ iv: 'aXZpdml2aXZpdml2', data: `ZGF0YQ${i}` }) });
        expect(r.status).toBe(201);
        expect((await r.json()).seq).toBe(i);
      }
      const all = await (await fetch(`${base}/v1/g/${GID}/blobs?after=0`)).json();
      expect(all.items.map((x: { seq: number }) => x.seq)).toEqual([1, 2, 3]);
      expect(all.next).toBe(3);
      const later = await (await fetch(`${base}/v1/g/${GID}/blobs?after=2`)).json();
      expect(later.items).toHaveLength(1);
      expect(later.items[0].data).toBe('ZGF0YQ3');
      const none = await (await fetch(`${base}/v1/g/${GID}/blobs?after=3`)).json();
      expect(none).toEqual({ items: [], next: 3 });
    });
    it('keeps groups apart', async () => {
      if (skip()) return;
      const other = await (await fetch(`${base}/v1/g/another_group_0123456789/blobs?after=0`)).json();
      expect(other.items).toEqual([]);
    });
    it('rejects bad group ids, bad bodies and unknown paths', async () => {
      if (skip()) return;
      expect((await fetch(`${base}/v1/g/short/blobs`)).status).toBe(404);
      expect((await fetch(`${base}/nope`)).status).toBe(404);
      const bad = await fetch(`${base}/v1/g/${GID}/blobs`, { method: 'POST', body: '{"iv":"<script>","data":"x"}' });
      expect(bad.status).toBe(400);
      const junk = await fetch(`${base}/v1/g/${GID}/blobs`, { method: 'POST', body: 'not json' });
      expect(junk.status).toBe(400);
    });
    it('pages long lists 100 at a time', async () => {
      if (skip()) return;
      const g = 'paging_group_0123456789ab';
      for (let i = 0; i < 130; i++)
        await fetch(`${base}/v1/g/${g}/blobs`, { method: 'POST', body: JSON.stringify({ iv: 'aXY', data: 'ZA' }) });
      const p1 = await (await fetch(`${base}/v1/g/${g}/blobs?after=0`)).json();
      expect(p1.items).toHaveLength(100);
      const p2 = await (await fetch(`${base}/v1/g/${g}/blobs?after=${p1.next}`)).json();
      expect(p2.items).toHaveLength(30);
    }, 30000);
  });
}
