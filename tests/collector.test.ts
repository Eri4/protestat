import { beforeEach, describe, expect, it } from 'vitest';
import { collectSource, isDue } from '../src/lib/engine/collector';
import { ProtestatDB } from '../src/lib/store/db';
import { fixture, src } from './helpers';

let db: ProtestatDB;
beforeEach(async () => {
  db = new ProtestatDB(`t-${Math.random()}`);
  await db.open();
});

const balkan = src('al.balkanweb', { url: 'https://www.balkanweb.com/feed/' });

describe('collector', () => {
  it('stores new reports once and records success', async () => {
    await db.sources.put(balkan);
    const get = async () => ({ status: 200, body: fixture('balkanweb.xml'), etag: '"abc"' });
    const r1 = await collectSource(balkan, new Date(), get, db);
    expect(r1).toMatchObject({ ok: true, added: 10 });
    const r2 = await collectSource((await db.sources.get(balkan.id))!, new Date(), get, db);
    expect(r2.added).toBe(0);
    expect(await db.reports.count()).toBe(10);
    expect((await db.sources.get(balkan.id))!.etag).toBe('"abc"');
  });
  it('a 304 changes nothing but the success time', async () => {
    await db.sources.put(balkan);
    const r = await collectSource(balkan, new Date(), async () => ({ status: 304, body: '' }), db);
    expect(r).toMatchObject({ ok: true, notModified: true });
    expect((await db.sources.get(balkan.id))!.lastSuccessAt).toBeTruthy();
  });
  it('an empty body is a failure and keeps the old reports', async () => {
    await db.sources.put(balkan);
    await collectSource(balkan, new Date(), async () => ({ status: 200, body: fixture('balkanweb.xml') }), db);
    const r = await collectSource(balkan, new Date(), async () => ({ status: 200, body: fixture('asp-empty.xml') }), db);
    expect(r).toMatchObject({ ok: false, error: 'empty' });
    expect(await db.reports.count()).toBe(10);
    expect((await db.sources.get(balkan.id))!.failCount).toBe(1);
  });
  it('a 429 pauses the source for hours', async () => {
    await db.sources.put(balkan);
    const now = new Date();
    await collectSource(balkan, now, async () => ({ status: 429, body: '' }), db);
    const s = (await db.sources.get(balkan.id))!;
    expect(Date.parse(s.pausedUntil!) - now.getTime()).toBeGreaterThan(5 * 3600e3);
    expect(isDue(s, now.getTime() + 3600e3, true)).toBe(false);
  });
  it('respects intervals and backs off after failures', () => {
    const now = Date.now();
    const s = { ...balkan, lastAttemptAt: new Date(now - 5 * 60e3).toISOString() };
    expect(isDue(s, now, false)).toBe(false);
    expect(isDue(s, now, true)).toBe(true);
    expect(isDue({ ...s, failCount: 5 }, now, true)).toBe(false); // 16 min backoff
    expect(isDue({ ...s, enabled: false }, now, true)).toBe(false);
  });
});
