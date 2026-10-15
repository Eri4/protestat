import type { Category, PlaceRef, Report } from '../model/types';
import { SCHEMA_VERSION } from '../model/types';
import { nearestPlace } from '../geo/gazetteer';
import { sha256 } from '../engine/normalize';
import { peoplePayload, publicKeyB64, signText } from '../share/bundle';
import { CROWD_SOURCE_ID } from '../sources/custom';

/** Positions are rounded to ~200 m: enough to find a checkpoint, too coarse to pin a person. */
export const roundCoord = (x: number) => Math.round(x * 500) / 500;

export interface PeopleInput {
  category: Category;
  lat: number;
  lon: number;
  note: string;
  stance: 'seen' | 'gone';
  /** When confirming an existing report, reuse its exact place so both group together. */
  place?: PlaceRef;
  town?: PlaceRef;
  now?: Date;
}

export async function makePeopleReport(input: PeopleInput, keys: CryptoKeyPair): Promise<Report> {
  const lat = input.place?.lat ?? roundCoord(input.lat);
  const lon = input.place?.lon ?? roundCoord(input.lon);
  const near = input.place ? { landmark: undefined, town: input.town } : nearestPlace(lat, lon);
  const place: PlaceRef = input.place ?? {
    name: near.landmark?.name ?? near.town?.name ?? `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
    gazetteerId: `pt:${lat.toFixed(3)},${lon.toFixed(3)}`,
    lat,
    lon,
    precision: 'landmark',
  };
  const now = (input.now ?? new Date()).toISOString();
  const key = await publicKeyB64(keys.publicKey);
  const id = (await sha256(`${CROWD_SOURCE_ID}|${key}|${now}|${crypto.randomUUID()}`)).slice(0, 32);
  const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&r=${id.slice(0, 8)}#map=17/${lat}/${lon}`;
  const note = input.note.replace(/\s+/g, ' ').trim().slice(0, 200);
  const report: Report = {
    id,
    sourceId: CROWD_SOURCE_ID,
    sourceName: 'Raport nga njerëzit',
    url,
    canonicalUrl: url.split('#')[0],
    title: note || place.name,
    summary: note,
    lang: 'sq',
    publishedAt: now,
    collectedAt: now,
    places: near.town && near.town.gazetteerId !== place.gazetteerId ? [place, near.town] : [place],
    category: input.category,
    categoryBy: 'user',
    contentHash: id,
    denial: input.stance === 'gone',
    stance: input.stance,
    provenance: { origin: 'user' },
    schemaVersion: SCHEMA_VERSION,
  };
  report.reporter = { key, sig: await signText(keys.privateKey, peoplePayload(report)) };
  return report;
}

/** The ~1 km grid cell people reports are grouped by. */
export const peopleCell = (p: PlaceRef) => `${Math.round(p.lat * 100)},${Math.round(p.lon * 100)}`;
