import type { Candidate } from '../adapters';
import { SCHEMA_VERSION, type ISO, type Report, type Source } from '../model/types';
import { findPlaces, fold } from '../geo/gazetteer';
import { classify, isDenial } from './classify';

const TRACKING = /^(utm_|fbclid$|gclid$|mc_|igshid$|ref$|ref_src$|amp$)/i;

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    u.protocol = 'https:';
    u.host = u.host.replace(/^www\./, '').replace(/^m\./, '');
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.pathname = u.pathname.replace(/\/amp\/?$/, '/').replace(/\/+$/, '') || '/';
    return u.toString();
  } catch {
    return raw;
  }
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lower-case, accent-free, punctuation-free title words — the basis for repost detection. */
export function titleKey(title: string): string {
  return fold(title)
    .replace(/^(video|foto|live|breaking|e fundit|lajm i fundit)\s*[/:|-]\s*/i, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Word-trigram Jaccard similarity of two titles (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const grams = (s: string) => {
    const w = titleKey(s).split(' ').filter(Boolean);
    const g = new Set<string>();
    if (w.length < 3) g.add(w.join(' '));
    for (let i = 0; i + 2 < w.length; i++) g.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
    return g;
  };
  const A = grams(a);
  const B = grams(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

export async function toReport(c: Candidate, src: Source, collectedAt: ISO): Promise<Report> {
  const canon = canonicalUrl(c.url);
  const text = `${c.title}. ${c.summary}`;
  return {
    id: (await sha256(`${src.id}|${canon}`)).slice(0, 32),
    sourceId: src.id,
    sourceName: src.name,
    url: c.url,
    canonicalUrl: canon,
    title: c.title,
    summary: c.summary,
    lang: src.lang,
    publishedAt: c.publishedAt,
    collectedAt,
    places: c.places ?? findPlaces(text),
    category: c.category ?? classify(text, src.kind),
    categoryBy: 'rule',
    contentHash: (await sha256(titleKey(c.title))).slice(0, 32),
    denial: isDenial(text),
    provenance: { origin: 'collected' },
    schemaVersion: SCHEMA_VERSION,
  };
}
