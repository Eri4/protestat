import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';
import { SCHEMA_VERSION, CATEGORIES, type Report, type Source } from '../model/types';

export const BUNDLE_FORMAT = 'protestat-bundle';
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 50 * 1024 * 1024;
const MAX_RATIO = 50;
const MAX_REPORTS = 20000;

const httpUrl = z
  .string()
  .max(2000)
  .refine((u) => {
    try {
      const p = new URL(u).protocol;
      return p === 'https:' || p === 'http:';
    } catch {
      return false;
    }
  }, 'url');
const iso = z.string().max(40).refine((s) => Number.isFinite(Date.parse(s)), 'date');

const PlaceSchema = z.object({
  name: z.string().max(120),
  gazetteerId: z.string().max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  precision: z.enum(['landmark', 'city', 'region', 'country']),
});

const ReportSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{32}$/),
  sourceId: z.string().max(80),
  sourceName: z.string().max(120),
  url: httpUrl,
  canonicalUrl: httpUrl,
  title: z.string().min(1).max(300),
  summary: z.string().max(400),
  lang: z.string().max(10),
  publishedAt: iso.optional(),
  collectedAt: iso,
  places: z.array(PlaceSchema).max(5),
  category: z.enum(CATEGORIES as [string, ...string[]]),
  categoryBy: z.enum(['rule', 'user']),
  contentHash: z.string().max(64),
  denial: z.boolean(),
  timeApprox: z.boolean().optional(),
  reporter: z.object({ key: z.string().max(400), sig: z.string().max(400) }).optional(),
  stance: z.enum(['seen', 'gone']).optional(),
  schemaVersion: z.literal(SCHEMA_VERSION),
});

const SourceSchema = z.object({
  id: z.string().max(80),
  name: z.string().max(120),
  url: httpUrl,
  adapter: z.enum(['rss', 'telegram', 'html']),
  lang: z.string().max(10),
});

const BundleBody = z.object({
  format: z.literal(BUNDLE_FORMAT),
  schemaVersion: z.literal(SCHEMA_VERSION),
  bundleId: z.string().max(64),
  createdAt: iso,
  senderKey: z.string().max(400),
  reports: z.array(ReportSchema).max(MAX_REPORTS),
  sources: z.array(SourceSchema).max(200),
});
const BundleSchema = BundleBody.extend({ signature: z.string().max(400) });

export type BundleReport = z.infer<typeof ReportSchema>;
export type SharedSource = z.infer<typeof SourceSchema>;
export type Bundle = z.infer<typeof BundleSchema>;

/** JSON with sorted keys, so the signature does not depend on key order. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

export const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
};
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const;

export async function signText(priv: CryptoKey, text: string): Promise<string> {
  return b64(await crypto.subtle.sign(SIGN, priv, strToU8(text)));
}

export async function verifyText(publicKey: string, sig: string, text: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('spki', unb64(publicKey), ALG, false, ['verify']);
    return await crypto.subtle.verify(SIGN, key, unb64(sig), strToU8(text));
  } catch {
    return false;
  }
}

export async function generateKeys(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
}

export async function publicKeyB64(pub: CryptoKey): Promise<string> {
  return b64(await crypto.subtle.exportKey('spki', pub));
}

/** Short, human-checkable fingerprint of a sender key, e.g. "7F3A-91C2". */
export async function fingerprint(senderKey: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', unb64(senderKey)));
  const hex = Array.from(h.slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

function stripReport(r: Report): BundleReport {
  // Only public report fields travel; local provenance, pins and user data stay on the phone.
  return {
    id: r.id,
    sourceId: r.sourceId,
    sourceName: r.sourceName,
    url: r.url,
    canonicalUrl: r.canonicalUrl,
    title: r.title,
    summary: r.summary,
    lang: r.lang,
    publishedAt: r.publishedAt,
    collectedAt: r.collectedAt,
    places: r.places,
    category: r.category,
    categoryBy: r.categoryBy,
    contentHash: r.contentHash,
    denial: r.denial,
    timeApprox: r.timeApprox,
    reporter: r.reporter,
    stance: r.stance,
    schemaVersion: SCHEMA_VERSION,
  };
}

export async function createBundle(reports: Report[], sources: Source[], keys: CryptoKeyPair): Promise<Uint8Array> {
  const body = {
    format: BUNDLE_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    bundleId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    senderKey: await publicKeyB64(keys.publicKey),
    reports: reports.map(stripReport),
    sources: sources
      .filter((s) => !s.builtIn && s.adapter !== 'emsc')
      .map((s) => ({ id: s.id, name: s.name, url: s.url, adapter: s.adapter as 'rss' | 'telegram' | 'html', lang: s.lang })),
  };
  const sig = await crypto.subtle.sign(SIGN, keys.privateKey, strToU8(canonicalJson(body)));
  return gzipSync(strToU8(JSON.stringify({ ...body, signature: b64(sig) })), { level: 9 });
}

export class BundleError extends Error {
  constructor(public code: 'too-big' | 'not-gzip' | 'bomb' | 'not-json' | 'schema' | 'signature') {
    super(code);
  }
}

export interface OpenedBundle {
  bundle: Bundle;
  fingerprint: string;
  rejected: number;
}

/** Validates a received file. Anything malformed is rejected before it touches storage. */
export async function openBundle(file: Uint8Array): Promise<OpenedBundle> {
  if (file.byteLength > MAX_FILE_BYTES) throw new BundleError('too-big');
  if (file[0] !== 0x1f || file[1] !== 0x8b) throw new BundleError('not-gzip');
  // gzip stores the uncompressed size (mod 2^32) in its last 4 bytes: check before inflating.
  const n = file.byteLength;
  const declared = (file[n - 4] | (file[n - 3] << 8) | (file[n - 2] << 16) | (file[n - 1] << 24)) >>> 0;
  if (declared > MAX_EXPANDED_BYTES || declared > n * MAX_RATIO) throw new BundleError('bomb');
  let text: string;
  try {
    const out = gunzipSync(file);
    if (out.byteLength > MAX_EXPANDED_BYTES) throw new BundleError('bomb');
    text = strFromU8(out);
  } catch (e) {
    if (e instanceof BundleError) throw e;
    throw new BundleError('not-gzip');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BundleError('not-json');
  }
  // Validate the envelope first, then each report on its own so one bad report doesn't sink the rest.
  const env = BundleSchema.extend({ reports: z.array(z.unknown()).max(MAX_REPORTS) }).safeParse(raw);
  if (!env.success) throw new BundleError('schema');
  const { signature, ...body } = env.data;
  try {
    const key = await crypto.subtle.importKey('spki', unb64(body.senderKey), ALG, false, ['verify']);
    const ok = await crypto.subtle.verify(SIGN, key, unb64(signature), strToU8(canonicalJson(body)));
    if (!ok) throw new Error();
  } catch {
    throw new BundleError('signature');
  }
  const reports: BundleReport[] = [];
  let rejected = 0;
  for (const r of body.reports) {
    const p = ReportSchema.safeParse(r);
    // A people report must carry its reporter's own valid signature; otherwise anyone could
    // forward one report many times and make it look confirmed by many people.
    if (p.success && (p.data.sourceId !== 'crowd' || (await verifyPeopleSignature(p.data)))) reports.push(p.data);
    else rejected++;
  }
  return {
    bundle: { ...body, reports, signature },
    fingerprint: await fingerprint(body.senderKey),
    rejected,
  };
}

/** The exact fields a reporter signs on a people report. */
export function peoplePayload(r: Pick<BundleReport, 'id' | 'category' | 'places' | 'summary' | 'publishedAt' | 'stance'>): string {
  const p = r.places[0];
  return canonicalJson({ id: r.id, category: r.category, lat: p?.lat, lon: p?.lon, summary: r.summary, publishedAt: r.publishedAt, stance: r.stance });
}

export async function verifyPeopleSignature(r: BundleReport): Promise<boolean> {
  return !!r.reporter && verifyText(r.reporter.key, r.reporter.sig, peoplePayload(r));
}
