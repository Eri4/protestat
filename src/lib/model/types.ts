// Schema v1. Every stored or shared object follows these shapes.
// Times are UTC ISO-8601 strings.

export type ISO = string;
export const SCHEMA_VERSION = 1 as const;

export type SourceKind = 'official' | 'police' | 'news' | 'factcheck' | 'hazard' | 'telegram' | 'user';
export type Authority = 'authoritative' | 'established' | 'other';
/**
 * Trust tier of a source (the project's published benchmark, see Guides):
 * A official · B established newsroom · C portal/aggregator/social-first · D unverified (user-added, Telegram, people).
 */
export type Tier = 'A' | 'B' | 'C' | 'D';
export const TIER_AUTHORITY: Record<Tier, Authority> = { A: 'authoritative', B: 'established', C: 'other', D: 'other' };
export type AdapterId = 'rss' | 'telegram' | 'html' | 'emsc';

export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  authority: Authority;
  tier: Tier;
  url: string;
  adapter: AdapterId;
  /** Region the source mainly covers. */
  region?: 'AL' | 'XK' | 'MK' | 'INT';
  lang: string;
  /** Politeness floor between fetches, in minutes. Never below 10. */
  minIntervalMin: number;
  enabled: boolean;
  builtIn: boolean;
  /** Sources that republish each other count once (e.g. one media group). */
  family?: string;
  lastAttemptAt?: ISO;
  lastSuccessAt?: ISO;
  lastError?: string;
  failCount?: number;
  pausedUntil?: ISO;
  etag?: string;
  lastModified?: string;
  itemCount?: number;
}

export type Category =
  | 'demonstration'
  | 'road-closure'
  | 'traffic'
  | 'emergency'
  | 'hazard'
  | 'police-notice'
  | 'police-presence'
  | 'official-notice'
  | 'other';

export const CATEGORIES: Category[] = [
  'demonstration',
  'police-presence',
  'road-closure',
  'traffic',
  'emergency',
  'hazard',
  'police-notice',
  'official-notice',
  'other',
];

export type Precision = 'landmark' | 'city' | 'region' | 'country';

export interface PlaceRef {
  name: string;
  gazetteerId: string;
  lat: number;
  lon: number;
  precision: Precision;
}

export interface Report {
  /** sha256(sourceId + canonicalUrl), hex, first 32 chars */
  id: string;
  sourceId: string;
  sourceName: string;
  url: string;
  canonicalUrl: string;
  title: string;
  /** Original language, at most 300 characters. */
  summary: string;
  lang: string;
  publishedAt?: ISO;
  /** True when publishedAt is only "first seen on the page" (sites without dates). */
  timeApprox?: boolean;
  collectedAt: ISO;
  places: PlaceRef[];
  category: Category;
  categoryBy: 'rule' | 'user';
  /** Normalised title hash, for repost detection. */
  contentHash: string;
  /** True when a report denies or corrects something. */
  denial: boolean;
  provenance: { origin: 'collected' | 'imported' | 'user'; bundleId?: string; senderKey?: string };
  /**
   * People reports only: the reporter's public key (random per phone) and a signature over the report,
   * so a forwarded report can't be passed off as a new person confirming it.
   */
  reporter?: { key: string; sig: string };
  /** People reports only: "seen" (it's there) or "gone" (it's no longer there). */
  stance?: 'seen' | 'gone';
  pinned?: boolean;
  schemaVersion: typeof SCHEMA_VERSION;
}

export type ConfidenceState =
  | 'unverified'
  | 'low'
  | 'moderate'
  | 'high'
  | 'confirmed'
  | 'disputed'
  | 'stale';

export interface Reason {
  key: string;
  params?: Record<string, string | number>;
}

export interface Assessment {
  occurred: ConfidenceState;
  /** People reports: distinct phones that saw it / say it's gone. */
  people?: { seen: number; gone: number };
  /** True when sources or people contradict each other. */
  conflict?: boolean;
  location: ConfidenceState;
  time: ConfidenceState;
  reasons: Reason[];
  independentSources: number;
  assessedAt: ISO;
  method: 'rules-v1';
}

export interface Incident {
  id: string;
  category: Category;
  place: PlaceRef;
  /** Other places the reports mention, most-mentioned first. */
  places: PlaceRef[];
  title: string;
  firstSeen: ISO;
  lastSeen: ISO;
  reportIds: string[];
  sourceIds: string[];
  assessment: Assessment;
  status: 'active' | 'historical' | 'stale';
}
