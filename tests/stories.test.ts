import { describe, expect, it } from 'vitest';
import { buildIncidents, splitByStory } from '../src/lib/engine/incidents';
import { rep, src } from './helpers';

const sources = [src('a'), src('b'), src('c'), src('eu.emsc', { authority: 'authoritative', tier: 'A' })];
const tirana = { name: 'Tirana', gazetteerId: 'gn:3183875', lat: 41.33, lon: 19.82, precision: 'city' as const };
const lm = (name: string, id: string) => ({ name, gazetteerId: id, lat: 41.32, lon: 19.82, precision: 'landmark' as const });

describe('grouping by story', () => {
  it('different police stories in the same town stay separate events', () => {
    const reports = [
      rep({ sourceId: 'a', category: 'police-notice', places: [tirana], title: 'Arrestohet 30-vjeçari për vjedhje banese në Kombinat' }),
      rep({ sourceId: 'b', category: 'police-notice', places: [tirana], title: 'Kapet me drogë në makinë një shofer taksie te Unaza e Re' }),
      rep({ sourceId: 'c', category: 'police-notice', places: [tirana], title: 'Lypsarët në rrugë, dyshohet për rrjet të organizuar trafikimi' }),
    ];
    expect(buildIncidents(reports, sources)).toHaveLength(3);
  });
  it('the same story from different outlets is one event with several sources', () => {
    const reports = [
      rep({ sourceId: 'a', category: 'emergency', places: [tirana], title: 'Plagoset me armë zjarri një 45-vjeçar në Tiranë' }),
      rep({ sourceId: 'b', category: 'emergency', places: [tirana], title: 'Tiranë, plagoset me armë 45-vjeçari, policia në vendngjarje' }),
      rep({ sourceId: 'c', category: 'emergency', places: [tirana], title: 'Zjarr në një pallat në Kombinat, evakuohen banorët' }),
    ];
    const inc = buildIncidents(reports, sources);
    expect(inc).toHaveLength(2);
    expect(inc.find((i) => /45/.test(i.title))!.assessment.independentSources).toBe(2);
  });
  it('earthquakes are never merged with each other', () => {
    const al = { ...tirana, name: 'Albania', gazetteerId: 'emsc:1' };
    const quakes = [1, 2, 3].map((n) =>
      rep({ sourceId: 'eu.emsc', category: 'hazard', places: [{ ...al, gazetteerId: `emsc:${n}` }], title: `M2.${n} – Albania`, canonicalUrl: `https://x/${n}` }),
    );
    expect(splitByStory(quakes)).toHaveLength(3);
  });
  it('protests stay one event per town but count each place named', () => {
    const k = lm('Kryeministria', 'lm:kryeministria');
    const q = lm('Qyteti Studenti', 'lm:qyteti-studenti');
    const reports = [
      rep({ sourceId: 'a', places: [k, tirana] }),
      rep({ sourceId: 'b', places: [k] }),
      rep({ sourceId: 'c', places: [q, tirana] }),
      rep({ sourceId: 'a', places: [tirana] }),
    ];
    const inc = buildIncidents(reports, sources);
    expect(inc).toHaveLength(1);
    expect(inc[0].placeCounts.map((p) => `${p.place.name}:${p.reports}`)).toEqual(['Kryeministria:2', 'Qyteti Studenti:1', 'Tirana:1']);
  });
});
