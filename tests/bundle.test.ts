import { describe, expect, it } from 'vitest';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { BundleError, createBundle, generateKeys, openBundle } from '../src/lib/share/bundle';
import { importBundle } from '../src/lib/share/io';
import { ProtestatDB } from '../src/lib/store/db';
import { rep, src } from './helpers';

const reports = () => [rep({ sourceId: 'a' }), rep({ sourceId: 'b', publishedAt: undefined })];

describe('bundles', () => {
  it('round-trips, verifies and reports a fingerprint', async () => {
    const keys = await generateKeys();
    const file = await createBundle(reports(), [src('x', { builtIn: false })], keys);
    const { bundle, fingerprint, rejected } = await openBundle(file);
    expect(bundle.reports).toHaveLength(2);
    expect(bundle.sources).toHaveLength(1);
    expect(fingerprint).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(rejected).toBe(0);
  });
  it('rejects a tampered bundle', async () => {
    const file = await createBundle(reports(), [], await generateKeys());
    const j = JSON.parse(strFromU8(gunzipSync(file)));
    j.reports[0].title = 'Changed';
    await expect(openBundle(gzipSync(strToU8(JSON.stringify(j))))).rejects.toThrow('signature');
  });
  it('rejects non-gzip, junk JSON and decompression bombs', async () => {
    await expect(openBundle(strToU8('hello'))).rejects.toBeInstanceOf(BundleError);
    await expect(openBundle(gzipSync(strToU8('{not json')))).rejects.toThrow('not-json');
    const bomb = gzipSync(new Uint8Array(30 * 1024 * 1024));
    await expect(openBundle(bomb)).rejects.toThrow('bomb');
  });
  it('drops reports with javascript: links even in a signed bundle', async () => {
    const bad = rep({ url: 'javascript:alert(1)' });
    const { bundle, rejected } = await openBundle(await createBundle([bad, rep()], [], await generateKeys()));
    expect(rejected).toBe(1);
    expect(bundle.reports).toHaveLength(1);
  });
  it('imports as copies: provenance kept, duplicates skipped', async () => {
    const db = new ProtestatDB(`b-${Math.random()}`);
    await db.open();
    const rs = reports();
    await db.reports.add(rs[0]);
    const s = await importBundle(await createBundle(rs, [], await generateKeys()), db);
    expect(s).toMatchObject({ added: 1, duplicates: 1, rejected: 0 });
    expect((await db.reports.get(rs[1].id))!.provenance.origin).toBe('imported');
    expect((await db.reports.get(rs[0].id))!.provenance.origin).toBe('collected');
  });
});
