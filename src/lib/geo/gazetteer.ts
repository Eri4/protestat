import type { PlaceRef } from '../model/types';
import placesData from './places.json';

interface GPlace {
  id: string;
  name: string;
  keys: string[];
  lat: number;
  lon: number;
  pop: number;
  cc: string;
}

export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ë/g, 'e').replace(/ç/g, 'c');

// Tirana landmarks often named in protest and traffic news.
// Coordinates are approximate (within ~300 m); the map always draws them as a ~500 m area.
interface Landmark {
  id: string;
  name: string;
  lat: number;
  lon: number;
  pattern: RegExp; // matched against folded text
  /** A government building whose name is often used for the institution itself ("the Ministry said…"). */
  institution?: boolean;
}
const LANDMARKS: Landmark[] = [
  { id: 'lm:skenderbej', name: 'Sheshi Skënderbej', lat: 41.3275, lon: 19.8187, pattern: /\bshesh(?:i|in|it)? (?:e )?skenderbe/ },
  { id: 'lm:kryeministria', name: 'Kryeministria', lat: 41.3237, lon: 19.8213, pattern: /\bkryeministri(?:a|se|ne)\b/, institution: true },
  { id: 'lm:kuvendi', name: 'Kuvendi', lat: 41.3226, lon: 19.8231, pattern: /\bkuvend(?:i|it|in)\b|\bparlament(?:i|it|in)\b/, institution: true },
  { id: 'lm:min-arsimit', name: 'Ministria e Arsimit', lat: 41.3302, lon: 19.812, pattern: /\bministri(?:a|se|ne) (?:e |se )?arsimit\b/, institution: true },
  { id: 'lm:min-brendshme', name: 'Ministria e Brendshme', lat: 41.3283, lon: 19.8183, pattern: /\bministri(?:a|se|ne) (?:e |se )?brendshme\b/, institution: true },
  { id: 'lm:qyteti-studenti', name: 'Qyteti Studenti', lat: 41.3115, lon: 19.829, pattern: /\bqytet(?:i|in|it) student/ },
  { id: 'lm:nene-tereza', name: 'Sheshi Nënë Tereza', lat: 41.3176, lon: 19.8216, pattern: /\bshesh(?:i|in|it)? (?:e )?nene terez/ },
  { id: 'lm:deshmoret', name: 'Bulevardi Dëshmorët e Kombit', lat: 41.322, lon: 19.821, pattern: /\bdeshmoret e kombit\b/ },
  { id: 'lm:piramida', name: 'Piramida', lat: 41.3229, lon: 19.8226, pattern: /\bpiramid(?:a|es|en)\b/ },
  { id: 'lm:bashkia-tirane', name: 'Bashkia e Tiranës', lat: 41.327, lon: 19.8195, pattern: /\bbashki(?:a|se|ne) (?:e |se )?tiran/, institution: true },
  { id: 'lm:hotel-dajti', name: 'ish-Hotel Dajti (Bulevardi)', lat: 41.3233, lon: 19.8199, pattern: /\bhotel(?:i|it)? dajt/ },
  { id: 'lm:presidenca', name: 'Presidenca', lat: 41.3195, lon: 19.8178, pattern: /\bpresidenc(?:a|es|en)\b/, institution: true },
];

const index = new Map<string, GPlace>();
for (const p of placesData as GPlace[]) {
  for (const k of p.keys) if (!index.has(k)) index.set(k, p); // data is sorted by population
}

// Albanian definite/case endings, longest first: Tiranës, Durrësit, Shkodrën, Vlorës...
const SUFFIXES = ['it', 'in', 'is', 'es', 'en', 've', 'a', 'e', 'i', 's', 'n'];

function lookupWord(w: string): GPlace | undefined {
  if (w.length < 4) return undefined;
  const direct = index.get(w);
  if (direct) return direct;
  for (const suf of SUFFIXES) {
    if (!w.endsWith(suf) || w.length - suf.length < 4) continue;
    const stem = w.slice(0, -suf.length);
    const hit = index.get(stem) ?? index.get(stem + 'e') ?? index.get(stem + 'a');
    if (hit) return hit;
  }
  return undefined;
}

const toRef = (p: GPlace): PlaceRef => ({
  name: p.name,
  gazetteerId: p.id,
  lat: p.lat,
  lon: p.lon,
  precision: 'city',
});

/**
 * Finds landmarks and towns mentioned in the text, most specific first, at most 3.
 * Institutions (ministries, parliament…) count as a location only when asked: for protests or road blocks
 * "Kryeministria" is where people stand; in a crime story it is usually just the institution talking.
 */
export function findPlaces(text: string, includeInstitutions = true): PlaceRef[] {
  const f = fold(text);
  const out: PlaceRef[] = [];
  const seen = new Set<string>();
  for (const lm of LANDMARKS) {
    if (lm.institution && !includeInstitutions) continue;
    if (lm.pattern.test(f) && !seen.has(lm.id)) {
      seen.add(lm.id);
      out.push({ name: lm.name, gazetteerId: lm.id, lat: lm.lat, lon: lm.lon, precision: 'landmark' });
    }
  }
  // Names in the original text start with a capital letter; this avoids matching ordinary words.
  const words = text.match(/[A-ZÇË][A-Za-zÇçËë-]{3,}/g) ?? [];
  for (const w of words) {
    const p = lookupWord(fold(w));
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      out.push(toRef(p));
    }
    if (out.length >= 3) break;
  }
  return out.slice(0, 3);
}

/** Search by name for the place search box. */
export function searchPlaces(q: string, limit = 8): PlaceRef[] {
  const f = fold(q.trim());
  if (f.length < 2) return [];
  const res: PlaceRef[] = LANDMARKS.filter((l) => fold(l.name).includes(f)).map((l) => ({
    name: l.name,
    gazetteerId: l.id,
    lat: l.lat,
    lon: l.lon,
    precision: 'landmark' as const,
  }));
  for (const p of placesData as GPlace[]) {
    if (res.length >= limit) break;
    if (p.keys.some((k) => k.startsWith(f))) res.push(toRef(p));
  }
  return res.slice(0, limit);
}

/** Nearest known place (landmark within 1 km, otherwise town within 25 km) — used to name people reports. */
export function nearestPlace(lat: number, lon: number): { landmark?: PlaceRef; town?: PlaceRef } {
  const km = (a: number, b: number) => {
    const dLat = (a - lat) * 111.32;
    const dLon = (b - lon) * 111.32 * Math.cos((lat * Math.PI) / 180);
    return Math.hypot(dLat, dLon);
  };
  let landmark: PlaceRef | undefined;
  let best = 1;
  for (const l of LANDMARKS) {
    const d = km(l.lat, l.lon);
    if (d < best) {
      best = d;
      landmark = { name: l.name, gazetteerId: l.id, lat: l.lat, lon: l.lon, precision: 'landmark' };
    }
  }
  let town: PlaceRef | undefined;
  let bestTown = 25;
  for (const p of placesData as GPlace[]) {
    // Bigger towns win over villages at similar distance.
    const d = km(p.lat, p.lon) - Math.min(4, Math.log10(Math.max(p.pop, 1)) * 0.6);
    if (d < bestTown) {
      bestTown = d;
      town = toRef(p);
    }
  }
  return { landmark, town };
}
