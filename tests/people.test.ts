import { describe, expect, it } from 'vitest';
import { makePeopleReport } from '../src/lib/crowd/people';
import { buildIncidents } from '../src/lib/engine/incidents';
import { classify } from '../src/lib/engine/classify';
import { createBundle, generateKeys, openBundle, verifyPeopleSignature } from '../src/lib/share/bundle';
import { CROWD_SOURCE } from '../src/lib/sources/custom';
import { accountForUrl, defaultSources } from '../src/lib/sources/defaults';
import { rep, src } from './helpers';

const SKANDERBEG = { lat: 41.3275, lon: 19.8187 };
const sources = [CROWD_SOURCE, src('a'), src('b'), src('c')];
const minutesAgo = (m: number) => new Date(Date.now() - m * 60e3);

async function people(n: number, stance: 'seen' | 'gone' = 'seen', ago = 10) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(await makePeopleReport({ category: 'police-presence', ...SKANDERBEG, note: '', stance, now: minutesAgo(ago) }, await generateKeys()));
  }
  return out;
}
const only = (reports: Awaited<ReturnType<typeof people>>) => {
  const inc = buildIncidents(reports, sources).filter((i) => i.sourceIds.includes('crowd'));
  expect(inc).toHaveLength(1);
  return inc[0];
};

describe('people reports', () => {
  it('are signed, rounded to ~200 m and named after the nearest place', async () => {
    const [r] = await people(1);
    expect(await verifyPeopleSignature(r)).toBe(true);
    // Rounding moves the point ~100 m; the nearest landmark is one of those on the square.
    expect(['Sheshi Skënderbej', 'Ministria e Brendshme', 'Bashkia e Tiranës']).toContain(r.places[0].name);
    expect(Math.round(r.places[0].lat * 500)).toBe(r.places[0].lat * 500);
  });
  it('1 person = unverified, 2 = low, 3 = moderate, never higher alone', async () => {
    expect(only(await people(1)).assessment.occurred).toBe('unverified');
    expect(only(await people(2)).assessment.occurred).toBe('low');
    const i = only(await people(5));
    expect(i.assessment.occurred).toBe('moderate');
    expect(i.assessment.people).toEqual({ seen: 5, gone: 0 });
  });
  it('the same phone confirming twice counts once', async () => {
    const keys = await generateKeys();
    const a = await makePeopleReport({ category: 'police-presence', ...SKANDERBEG, note: '', stance: 'seen' }, keys);
    const b = await makePeopleReport({ category: 'police-presence', ...SKANDERBEG, note: '', stance: 'seen', place: a.places[0] }, keys);
    expect(only([a, b]).assessment.people?.seen).toBe(1);
  });
  it('"gone" from most people ends it; from a minority it is a conflict', async () => {
    const seen = await people(1, 'seen', 30);
    const gone = await people(2, 'gone', 5);
    const ended = only([...seen, ...gone]);
    expect(ended.status).toBe('stale');
    expect(ended.assessment.reasons.map((r) => r.key)).toContain('reason.goneEnded');

    const seen3 = await people(3, 'seen', 30);
    const gone1 = await people(1, 'gone', 5);
    const c = only([...seen3, ...gone1]);
    expect(c.assessment.occurred).toBe('disputed');
    expect(c.assessment.conflict).toBe(true);
  });
  it('goes old after 3 hours for police on the ground', async () => {
    const i = only(await people(3, 'seen', 4 * 60));
    expect(i.status).toBe('stale');
    expect(i.assessment.occurred).toBe('stale');
  });
  it('news about the same thing in the same town raises it; a news denial marks a conflict', async () => {
    const town = { name: 'Tirana', gazetteerId: 'gn:3183875', lat: 41.33, lon: 19.82, precision: 'city' as const };
    const news = [rep({ sourceId: 'a', category: 'police-presence', places: [town] }), rep({ sourceId: 'b', category: 'police-presence', places: [town] })];
    const ppl = await people(1);
    expect(ppl[0].places[1]?.name).toBe('Tirana');
    const i = buildIncidents([...ppl, ...news], sources).find((x) => x.sourceIds.includes('crowd'))!;
    expect(i.assessment.occurred).toBe('moderate');
    expect(i.assessment.reasons.map((r) => r.key)).toContain('reason.newsAlso');

    const denial = [rep({ sourceId: 'a', category: 'police-presence', places: [town] }), rep({ sourceId: 'b', category: 'police-presence', places: [town], denial: true })];
    const j = buildIncidents([...(await people(2)), ...denial], sources).find((x) => x.sourceIds.includes('crowd'))!;
    expect(j.assessment.conflict).toBe(true);
  });
  it('a forged copy (changed text, same signature) is rejected on import', async () => {
    const [r] = await people(1);
    const forged = { ...r, id: 'f'.repeat(32), summary: 'changed' };
    const { bundle, rejected } = await openBundle(await createBundle([r, forged], [], await generateKeys()));
    expect(bundle.reports).toHaveLength(1);
    expect(rejected).toBe(1);
  });
});

describe('catalogue and classification', () => {
  it('every built-in source has a tier, a unique id and an https URL', () => {
    const all = defaultSources();
    expect(all.length).toBeGreaterThan(45);
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    for (const s of all) {
      expect(['A', 'B', 'C']).toContain(s.tier);
      expect(s.url).toMatch(/^https:\/\//);
    }
    expect(all.find((s) => s.id === 'al.joq')?.tier).toBe('C');
    expect(all.some((s) => /evropaelire|balkaninsight/.test(s.url))).toBe(false);
  });
  it('matches pasted links to known social accounts', () => {
    expect(accountForUrl('https://www.instagram.com/joqalbania/')?.name).toBe('JOQ Albania');
    expect(accountForUrl('https://www.tiktok.com/@faktoje.al/video/123')?.tier).toBe('B');
    expect(accountForUrl('https://example.com/x')).toBeUndefined();
  });
  it('recognises police checkpoints in the news', () => {
    expect(classify('Postblloqe të policisë në hyrje të Tiranës', 'news')).toBe('police-presence');
    expect(classify('Forca të shumta policie në terren në Durrës', 'news')).toBe('police-presence');
  });
});
