import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Report, Source } from '../src/lib/model/types';

export const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');

export function src(id: string, over: Partial<Source> = {}): Source {
  return {
    id,
    name: id,
    kind: 'news',
    authority: 'established',
    tier: 'B',
    url: `https://${id}.example/feed/`,
    adapter: 'rss',
    lang: 'sq',
    minIntervalMin: 10,
    enabled: true,
    builtIn: true,
    ...over,
  };
}

let n = 0;
export function rep(over: Partial<Report> = {}): Report {
  n++;
  const id = n.toString(16).padStart(32, '0');
  return {
    id,
    sourceId: 'a',
    sourceName: 'a',
    url: `https://a.example/${n}`,
    canonicalUrl: `https://a.example/${n}`,
    title: `Title number ${n} about something different ${n}`,
    summary: '',
    lang: 'sq',
    publishedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    places: [{ name: 'Tirana', gazetteerId: 'gn:3183875', lat: 41.33, lon: 19.82, precision: 'city' }],
    category: 'demonstration',
    categoryBy: 'rule',
    contentHash: id,
    denial: false,
    provenance: { origin: 'collected' },
    schemaVersion: 1,
    ...over,
  };
}
