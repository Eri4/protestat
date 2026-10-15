import { describe, expect, it } from 'vitest';
import { buildIncidents, independentUnits } from '../src/lib/engine/incidents';
import { rep, src } from './helpers';

const sources = [
  src('a'),
  src('b'),
  src('c'),
  src('d', { family: 'grp' }),
  src('e', { family: 'grp' }),
  src('police', { authority: 'authoritative', kind: 'police' }),
  src('tg', { authority: 'other', kind: 'telegram' }),
  src('tg2', { authority: 'other', kind: 'telegram' }),
];
const one = (reports: ReturnType<typeof rep>[], now = Date.now()) => {
  const inc = buildIncidents(reports, sources, now);
  expect(inc).toHaveLength(1);
  return inc[0];
};

describe('confidence rules', () => {
  it('one established source gives low', () => {
    expect(one([rep({ sourceId: 'a' })]).assessment.occurred).toBe('low');
  });
  it('two independent established sources give moderate, three give high', () => {
    expect(one([rep({ sourceId: 'a' }), rep({ sourceId: 'b' })]).assessment.occurred).toBe('moderate');
    expect(one([rep({ sourceId: 'a' }), rep({ sourceId: 'b' }), rep({ sourceId: 'c' })]).assessment.occurred).toBe('high');
  });
  it('outlets of the same media group count once', () => {
    expect(one([rep({ sourceId: 'd' }), rep({ sourceId: 'e' })]).assessment.occurred).toBe('low');
  });
  it('copied text across outlets counts once', () => {
    const t = 'Studentët protestojnë para Ministrisë së Arsimit në Tiranë sot';
    const i = one([rep({ sourceId: 'a', title: t }), rep({ sourceId: 'b', title: `VIDEO/ ${t}` })]);
    expect(i.assessment.occurred).toBe('low');
    expect(i.assessment.independentSources).toBe(1);
  });
  it('an authoritative source confirms', () => {
    expect(one([rep({ sourceId: 'police' })]).assessment.occurred).toBe('confirmed');
  });
  it('a shared report claiming to be from the Police does not confirm', () => {
    const i = one([rep({ sourceId: 'police', provenance: { origin: 'imported', bundleId: 'x' } })]);
    expect(i.assessment.occurred).toBe('unverified');
  });
  it('unverified channels alone stay unverified or low', () => {
    expect(one([rep({ sourceId: 'tg' })]).assessment.occurred).toBe('unverified');
    expect(one([rep({ sourceId: 'tg' }), rep({ sourceId: 'tg2' })]).assessment.occurred).toBe('low');
  });
  it('a denial from an equal source marks it disputed', () => {
    const i = one([rep({ sourceId: 'a' }), rep({ sourceId: 'b', denial: true })]);
    expect(i.assessment.occurred).toBe('disputed');
  });
  it('an old report is stale or historical, never active', () => {
    const old = new Date(Date.now() - 20 * 3600e3).toISOString();
    const i = one([rep({ sourceId: 'a', publishedAt: old, collectedAt: new Date().toISOString() })]);
    expect(i.status).toBe('stale');
    expect(i.assessment.occurred).toBe('stale');
    const older = new Date(Date.now() - 30 * 864e5).toISOString();
    expect(one([rep({ sourceId: 'a', publishedAt: older })]).status).toBe('historical');
  });
  it('a report with no publication date is never active', () => {
    const i = one([rep({ sourceId: 'a', publishedAt: undefined })]);
    expect(i.status).not.toBe('active');
    expect(i.assessment.time).toBe('unverified');
  });
  it('reports far apart in time become separate incidents', () => {
    const t0 = Date.now();
    const r1 = rep({ sourceId: 'a', publishedAt: new Date(t0 - 40 * 3600e3).toISOString() });
    const r2 = rep({ sourceId: 'b', publishedAt: new Date(t0).toISOString() });
    expect(buildIncidents([r1, r2], sources, t0)).toHaveLength(2);
  });
  it('location confidence rises when two sources name the same landmark', () => {
    const lm = { name: 'Kryeministria', gazetteerId: 'lm:kryeministria', lat: 41.32, lon: 19.82, precision: 'landmark' as const };
    const i = one([rep({ sourceId: 'a', places: [lm] }), rep({ sourceId: 'b', places: [lm] })]);
    expect(i.place.precision).toBe('landmark');
    expect(i.assessment.location).toBe('moderate');
  });
  it('picks the place most sources name and lists the others', () => {
    const lm = { name: 'Qyteti Studenti', gazetteerId: 'lm:qyteti-studenti', lat: 41.31, lon: 19.83, precision: 'landmark' as const };
    const tirana = rep().places[0];
    const i = one([rep({ sourceId: 'a', places: [lm, tirana] }), rep({ sourceId: 'b', places: [tirana] }), rep({ sourceId: 'c', places: [tirana] })]);
    expect(i.place.name).toBe('Tirana');
    expect(i.places.map((p) => p.name)).toEqual(['Tirana', 'Qyteti Studenti']);
  });
  it('independentUnits merges by family', () => {
    const map = new Map(sources.map((s) => [s.id, s]));
    expect(independentUnits([rep({ sourceId: 'd' }), rep({ sourceId: 'e' })], map)).toHaveLength(1);
  });
});
