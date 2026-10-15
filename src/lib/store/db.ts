import Dexie, { type Table } from 'dexie';
import type { Incident, Report, Source } from '../model/types';
import { defaultSources } from '../sources/defaults';
import { USER_LINKS_SOURCE, CROWD_SOURCE } from '../sources/custom';

export interface Setting {
  key: string;
  value: unknown;
}

export class ProtestatDB extends Dexie {
  sources!: Table<Source, string>;
  reports!: Table<Report, string>;
  incidents!: Table<Incident, string>;
  settings!: Table<Setting, string>;

  constructor(name = 'protestat') {
    super(name);
    this.version(1).stores({
      sources: 'id, enabled',
      reports: 'id, sourceId, collectedAt, publishedAt, category, contentHash, pinned',
      incidents: 'id, lastSeen, category, status',
      settings: 'key',
    });
  }
}

export const db = new ProtestatDB();

/**
 * Adds missing built-in sources and refreshes the definitions of existing ones after an app
 * update (name, URL, type, trust level), keeping the user's on/off choice and fetch status.
 */
export async function seedSources(target: ProtestatDB = db): Promise<void> {
  const current = new Map((await target.sources.toArray()).map((s) => [s.id, s]));
  const catalogue = [...defaultSources(), USER_LINKS_SOURCE, CROWD_SOURCE];
  // Built-in sources dropped from the catalogue (e.g. robots.txt now forbids them) are removed.
  const ids = new Set(catalogue.map((s) => s.id));
  const gone = [...current.values()].filter((s) => s.builtIn && !ids.has(s.id)).map((s) => s.id);
  if (gone.length) await target.sources.bulkDelete(gone);
  const rows = catalogue.map((d) => {
    const old = current.get(d.id);
    if (!old) return d;
    const urlChanged = old.url !== d.url;
    return {
      ...old,
      name: d.name,
      url: d.url,
      kind: d.kind,
      authority: d.authority,
      tier: d.tier,
      region: d.region,
      adapter: d.adapter,
      family: d.family,
      minIntervalMin: d.minIntervalMin,
      ...(urlChanged ? { etag: undefined, lastModified: undefined } : {}),
    };
  });
  await target.sources.bulkPut(rows);
}

export async function getSetting<T>(key: string, fallback: T, target: ProtestatDB = db): Promise<T> {
  const row = await target.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown, target: ProtestatDB = db): Promise<void> {
  await target.settings.put({ key, value });
}

export const RETENTION_DAYS_DEFAULT = 30;
export const MAX_REPORTS = 20000;

/** Removes old unpinned reports and enforces a hard cap. Returns how many were removed. */
export async function cleanup(now = new Date(), target: ProtestatDB = db): Promise<number> {
  const days = await getSetting('retentionDays', RETENTION_DAYS_DEFAULT, target);
  const cutoff = new Date(now.getTime() - days * 864e5).toISOString();
  const old = await target.reports.where('collectedAt').below(cutoff).filter((r) => !r.pinned).primaryKeys();
  await target.reports.bulkDelete(old);
  let removed = old.length;
  const count = await target.reports.count();
  if (count > MAX_REPORTS) {
    const extra = await target.reports
      .orderBy('collectedAt')
      .filter((r) => !r.pinned)
      .limit(count - MAX_REPORTS)
      .primaryKeys();
    await target.reports.bulkDelete(extra);
    removed += extra.length;
  }
  return removed;
}

/** Deletes every report, incident, custom source and setting on this phone. */
export async function wipeAll(target: ProtestatDB = db): Promise<void> {
  await target.delete();
  await target.open();
  await seedSources(target);
}
