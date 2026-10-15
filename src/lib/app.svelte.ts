import type { Incident, Report, Source } from './model/types';
import { db, seedSources } from './store/db';
import { refreshAll, rebuildIncidents } from './engine/collector';
import { httpGet, isNative } from './engine/fetcher';
import { APP_VERSION, RELEASES_API } from './config';
import { myPublicKey } from './share/keys';

export const app = $state({
  ready: false,
  reports: [] as Report[],
  incidents: [] as Incident[],
  sources: [] as Source[],
  refreshing: false,
  progress: { done: 0, total: 0 },
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  lastRefresh: undefined as string | undefined,
  toast: '' as string,
  update: undefined as { version: string; url: string } | undefined,
  myKey: '' as string,
});

export async function load(): Promise<void> {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [reports, incidents, sources] = await Promise.all([
    db.reports.where('collectedAt').aboveOrEqual(since).toArray(),
    db.incidents.toArray(),
    db.sources.toArray(),
  ]);
  const time = (r: Report) => Date.parse(r.publishedAt ?? r.collectedAt);
  app.reports = reports.sort((a, b) => time(b) - time(a));
  app.incidents = incidents.sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen));
  app.sources = sources;
  app.lastRefresh =
    sources
      .map((s) => s.lastSuccessAt)
      .filter((x): x is string => !!x)
      .sort()
      .at(-1) ?? undefined;
}

export async function init(): Promise<void> {
  await seedSources();
  app.myKey = await myPublicKey();
  await rebuildIncidents();
  await load();
  app.ready = true;
  window.addEventListener('online', () => {
    app.online = true;
    void refresh(false);
  });
  window.addEventListener('offline', () => (app.online = false));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh(false);
  });
  // While the app is open, check every minute which sources are due.
  setInterval(() => {
    if (document.visibilityState === 'visible') void refresh(false);
  }, 60_000);
  void refresh(false);
  void checkUpdate(false);
}

export async function refresh(force: boolean): Promise<void> {
  if (app.refreshing) return;
  app.refreshing = true;
  app.progress = { done: 0, total: 0 };
  try {
    await refreshAll(force, (done, total) => (app.progress = { done, total }));
  } finally {
    app.refreshing = false;
    await load();
  }
}

export function toast(msg: string) {
  app.toast = msg;
  setTimeout(() => {
    if (app.toast === msg) app.toast = '';
  }, 4000);
}

const newer = (a: string, b: string) => {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
};

/** Android sideloaded builds check GitHub once a day for a newer release. The PWA updates itself. */
export async function checkUpdate(manual: boolean): Promise<'available' | 'latest' | 'error'> {
  if (!isNative() && !manual) return 'latest';
  try {
    const last = Number(localStorage.getItem('updateCheck') ?? 0);
    if (!manual && Date.now() - last < 864e5) return 'latest';
    localStorage.setItem('updateCheck', String(Date.now()));
    const res = await httpGet(RELEASES_API, { timeoutMs: 10000 });
    if (res.status !== 200) return 'error';
    const j = JSON.parse(res.body) as { tag_name?: string; html_url?: string };
    if (j.tag_name && j.html_url && newer(j.tag_name, APP_VERSION)) {
      app.update = { version: j.tag_name.replace(/^v/, ''), url: j.html_url };
      return 'available';
    }
    return 'latest';
  } catch {
    return 'error';
  }
}
