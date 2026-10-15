import { AdapterError, parseBySource } from '../adapters';
import type { Report, Source } from '../model/types';
import { db, cleanup, type ProtestatDB } from '../store/db';
import { httpGet, isNative, type FetchResult } from './fetcher';
import { buildIncidents } from './incidents';
import { toReport } from './normalize';

export interface SourceResult {
  sourceId: string;
  ok: boolean;
  notModified?: boolean;
  added: number;
  error?: string;
}

const CONCURRENCY = 3;
const MAX_BACKOFF_MIN = 60;
const BLOCK_PAUSE_H = 6;

/** Sources the browser (PWA) can read: only those that send CORS headers. */
const BROWSER_OK = /seismicportal\.eu|tirana\.al|youtube\.com\/oembed/;
// Developer option for desktop testing with a CORS proxy: localStorage['protestat.allSources'] = '1'.
const devAllSources = () => {
  try {
    return localStorage.getItem('protestat.allSources') === '1';
  } catch {
    return false;
  }
};
export const canFetchHere = (s: Source) => isNative() || BROWSER_OK.test(s.url) || devAllSources();

export function isDue(s: Source, now: number, force: boolean): boolean {
  if (!s.enabled) return false;
  if (s.pausedUntil && Date.parse(s.pausedUntil) > now) return false;
  const last = s.lastAttemptAt ? Date.parse(s.lastAttemptAt) : 0;
  // Even a manual refresh respects a 2-minute floor per source.
  const floorMin = force ? 2 : s.minIntervalMin;
  const backoffMin = s.failCount ? Math.min(MAX_BACKOFF_MIN, 2 ** (s.failCount - 1)) : 0;
  return now - last >= Math.max(floorMin, backoffMin) * 60e3;
}

type Getter = (url: string, opts: { etag?: string; lastModified?: string }) => Promise<FetchResult>;

export async function collectSource(
  src: Source,
  now = new Date(),
  get: Getter = httpGet,
  target: ProtestatDB = db,
): Promise<SourceResult> {
  const nowIso = now.toISOString();
  const patch: Partial<Source> = { lastAttemptAt: nowIso };
  try {
    const res = await get(src.url, { etag: src.etag, lastModified: src.lastModified });
    if (res.status === 304) {
      Object.assign(patch, { lastSuccessAt: nowIso, failCount: 0, lastError: undefined });
      await target.sources.update(src.id, patch);
      return { sourceId: src.id, ok: true, notModified: true, added: 0 };
    }
    if (res.status === 403 || res.status === 429) {
      // Blocked or rate-limited: back off for hours, never try to get around it.
      Object.assign(patch, {
        lastError: `http-${res.status}`,
        failCount: (src.failCount ?? 0) + 1,
        pausedUntil: new Date(now.getTime() + BLOCK_PAUSE_H * 3600e3).toISOString(),
      });
      await target.sources.update(src.id, patch);
      return { sourceId: src.id, ok: false, added: 0, error: `http-${res.status}` };
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`http-${res.status}`);

    const candidates = parseBySource(src.adapter, res.body, src.url);
    // Pages without dates: a headline that appears between two checks less than 2 h apart
    // was published in that window, so "now" is a fair approximate time. On a first check we can't know.
    const recentlyChecked = src.lastSuccessAt && now.getTime() - Date.parse(src.lastSuccessAt) < 2 * 3600e3;
    const known = new Set(
      src.adapter === 'html'
        ? await target.reports.where('sourceId').equals(src.id).toArray().then((rs) => rs.map((r) => r.url))
        : [],
    );
    const reports: Report[] = [];
    for (const c of candidates) {
      const r = await toReport(c, src, nowIso);
      if (src.adapter === 'html' && !r.publishedAt && recentlyChecked && !known.has(r.url)) {
        r.publishedAt = nowIso;
        r.timeApprox = true;
      }
      reports.push(r);
    }
    const existing = new Set(await target.reports.where('id').anyOf(reports.map((r) => r.id)).primaryKeys());
    const fresh = reports.filter((r) => !existing.has(r.id));
    if (fresh.length) await target.reports.bulkAdd(fresh);

    Object.assign(patch, {
      lastSuccessAt: nowIso,
      lastError: undefined,
      failCount: 0,
      pausedUntil: undefined,
      etag: res.etag,
      lastModified: res.lastModified,
      itemCount: candidates.length,
    });
    await target.sources.update(src.id, patch);
    return { sourceId: src.id, ok: true, added: fresh.length };
  } catch (e) {
    // An empty or broken response never deletes what we already have.
    const code = e instanceof AdapterError ? e.code : e instanceof Error ? e.message : 'error';
    Object.assign(patch, { lastError: code.slice(0, 80), failCount: (src.failCount ?? 0) + 1 });
    await target.sources.update(src.id, patch);
    return { sourceId: src.id, ok: false, added: 0, error: code };
  }
}

export async function rebuildIncidents(target: ProtestatDB = db, now = Date.now()): Promise<void> {
  const since = new Date(now - 10 * 864e5).toISOString();
  const reports = await target.reports.where('collectedAt').aboveOrEqual(since).toArray();
  const incidents = buildIncidents(reports, await target.sources.toArray(), now);
  await target.transaction('rw', target.incidents, async () => {
    await target.incidents.clear();
    await target.incidents.bulkPut(incidents);
  });
}

let running: Promise<SourceResult[]> | null = null;

/** Fetches every source that is due, a few at a time, then re-rates incidents. */
export function refreshAll(force = false, onProgress?: (done: number, total: number) => void): Promise<SourceResult[]> {
  if (running) return running;
  running = (async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return [];
      const now = Date.now();
      const due = (await db.sources.toArray()).filter((s) => canFetchHere(s) && isDue(s, now, force));
      const results: SourceResult[] = [];
      let i = 0;
      const worker = async () => {
        while (i < due.length) {
          const s = due[i++];
          results.push(await collectSource(s));
          onProgress?.(results.length, due.length);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, due.length) }, worker));
      await cleanup();
      await rebuildIncidents();
      return results;
    } finally {
      running = null;
    }
  })();
  return running;
}
