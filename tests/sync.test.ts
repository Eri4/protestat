// Two simulated phones syncing through the real relay server.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ProtestatDB, seedSources } from '../src/lib/store/db';
import { getGroup, joinGroup, leaveGroup, syncNow } from '../src/lib/sync/sync';
import { groupId, joinLink, newGroupKey, open, parseJoin, seal } from '../src/lib/sync/group';
import { isPrivateHost, httpGet } from '../src/lib/engine/fetcher';
import { makePeopleReport } from '../src/lib/crowd/people';
import { getKeys } from '../src/lib/share/keys';
import { rep } from './helpers';

let relay: ChildProcess;
let server = '';

beforeAll(async () => {
  const port = 19300 + Math.floor(Math.random() * 500);
  relay = spawn(process.execPath, [resolve(__dirname, '../server/relay.mjs')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: mkdtempSync(join(tmpdir(), 'sync-')) },
  });
  await new Promise<void>((res, rej) => {
    relay.stdout?.on('data', (d) => /listening/.test(String(d)) && res());
    setTimeout(() => rej(new Error('relay did not start')), 10000);
  });
  server = `http://127.0.0.1:${port}`;
});
afterAll(() => relay?.kill());

async function phone(name: string) {
  const db = new ProtestatDB(`${name}-${Math.random()}`);
  await db.open();
  await seedSources(db);
  return db;
}

describe('group sync', () => {
  it('join codes round-trip and reject junk', () => {
    const g = { server: 'https://relay.example.org', key: newGroupKey(), name: 'Studentët' };
    const link = joinLink(g);
    expect(parseJoin(`Bashkohu: ${link} faleminderit`)).toEqual(g);
    expect(parseJoin('protestat://join?s=x&k=short')).toBeNull();
    expect(parseJoin('hello')).toBeNull();
  });

  it('encrypts so the server cannot read, and a wrong key cannot open', async () => {
    const key = newGroupKey();
    const blob = await seal(key, new TextEncoder().encode('Postbllok te Kryeministria'));
    expect(atob(blob.data)).not.toContain('Postbllok');
    expect(new TextDecoder().decode(await open(key, blob))).toBe('Postbllok te Kryeministria');
    await expect(open(newGroupKey(), blob)).rejects.toThrow();
    expect(await groupId(key)).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('only allows plain http to local addresses', async () => {
    expect(isPrivateHost('192.168.43.1')).toBe(true);
    expect(isPrivateHost('10.0.0.5')).toBe(true);
    expect(isPrivateHost('172.20.1.1')).toBe(true);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
    expect(isPrivateHost('relay.example.org')).toBe(false);
    await expect(httpGet('http://example.org/x', { allowLan: true })).rejects.toThrow('only-https');
  });

  it('two phones share reports both ways; people stay counted as people; leaving keeps data', async () => {
    const A = await phone('A');
    const B = await phone('B');
    const key = newGroupKey();

    // Phone A has a news report it collected and a people report it made.
    await A.reports.add(rep({ sourceId: 'al.balkanweb', title: 'Protestë para Kryeministrisë' }));
    const pr = await makePeopleReport(
      { category: 'police-presence', lat: 41.3275, lon: 19.8187, note: '', stance: 'seen', detail: { kind: 'plainclothes', reason: 'id-checks' } },
      await getKeys(A),
    );
    await A.reports.add(pr);

    await joinGroup({ server, key, name: 'Test' }, {}, A);
    await joinGroup(parseJoin(joinLink({ server, key, name: 'Test' }))!, {}, B);

    const a1 = await syncNow(A);
    expect(a1?.lastError).toBeUndefined();
    expect(a1?.sent).toBe(2);

    const b1 = await syncNow(B);
    expect(b1?.lastError).toBeUndefined();
    expect(b1?.received).toBe(2);
    const got = await B.reports.get(pr.id);
    expect(got?.provenance.origin).toBe('imported');
    expect(got?.reporter?.key).toBe(pr.reporter?.key); // still counts as that person
    expect(got?.detail).toEqual({ kind: 'plainclothes', reason: 'id-checks' });

    // B reports something; A receives it, and A does not re-download its own upload.
    await B.reports.add(rep({ sourceId: 'al.euronews', title: 'Rrugë e bllokuar te Unaza' }));
    await syncNow(B);
    const a2 = await syncNow(A);
    expect(a2?.received).toBe(1);

    // B does not echo A's reports back (imported reports are never re-uploaded).
    const b2 = await syncNow(B);
    expect(b2?.sent).toBe(1);

    // Leaving keeps everything received.
    await leaveGroup(B);
    expect(await getGroup(B)).toBeNull();
    expect(await B.reports.get(pr.id)).toBeTruthy();
  }, 30000);

  it('a phone in another group sees nothing', async () => {
    const C = await phone('C');
    await joinGroup({ server, key: newGroupKey(), name: '' }, {}, C);
    const c = await syncNow(C);
    expect(c?.received).toBe(0);
  });

  it('reports a clear error when the server is gone, without losing state', async () => {
    const D = await phone('D');
    await joinGroup({ server: 'http://127.0.0.1:9', key: newGroupKey(), name: '' }, {}, D);
    await D.reports.add(rep({ sourceId: 'al.balkanweb' }));
    const d = await syncNow(D);
    expect(d?.lastError).toBeTruthy();
    expect(await D.reports.count()).toBe(1);
  });
});
