import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from '../engine/fetcher';
import { rebuildIncidents } from '../engine/collector';
import type { Report, Source } from '../model/types';
import { db, type ProtestatDB } from '../store/db';
import { createBundle, openBundle, type SharedSource } from './bundle';
import { getKeys } from './keys';

export { getKeys, myFingerprint, regenerateKeys } from './keys';

export async function exportReports(days: number): Promise<{ bytes: Uint8Array; count: number; name: string }> {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const reports = await db.reports.where('collectedAt').aboveOrEqual(since).toArray();
  const sources = await db.sources.toArray();
  const bytes = await createBundle(reports, sources, await getKeys());
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return { bytes, count: reports.length, name: `protestat-${stamp}.protestat` };
}

const toB64 = (u8: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Opens the phone's share menu (Telegram, WhatsApp, Signal, Bluetooth, e-mail…) with the file. */
export async function shareFile(bytes: Uint8Array, name: string, text: string): Promise<void> {
  if (isNative()) {
    const res = await Filesystem.writeFile({ path: name, data: toB64(bytes), directory: Directory.Cache });
    await Share.share({ title: name, text, files: [res.uri], dialogTitle: name });
    return;
  }
  const file = new File([bytes as BlobPart], name, { type: 'application/octet-stream' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name, text });
    return;
  }
  // Desktop browsers: plain download.
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function shareText(text: string, url?: string): Promise<void> {
  if (isNative()) {
    await Share.share({ text, url });
  } else if (navigator.share) {
    await navigator.share({ text, url });
  } else {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
  }
}

/** Telegram's own share link: opens Telegram with the message ready to send. Free, no bot or server. */
export const telegramShareUrl = (url: string, text: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

export interface ImportSummary {
  added: number;
  duplicates: number;
  rejected: number;
  fingerprint: string;
  suggestedSources: SharedSource[];
}

export async function importBundle(file: Uint8Array, target: ProtestatDB = db): Promise<ImportSummary> {
  const { bundle, fingerprint: fp, rejected } = await openBundle(file);
  const ids = bundle.reports.map((r) => r.id);
  const existing = new Set(await target.reports.where('id').anyOf(ids).primaryKeys());
  const fresh: Report[] = bundle.reports
    .filter((r) => !existing.has(r.id))
    .map((r) => ({ ...r, provenance: { origin: 'imported', bundleId: bundle.bundleId, senderKey: fp } }) as Report);
  if (fresh.length) await target.reports.bulkAdd(fresh);
  const known = new Set(await target.sources.toCollection().primaryKeys());
  const knownUrls = new Set((await target.sources.toArray()).map((s) => s.url));
  await rebuildIncidents(target);
  return {
    added: fresh.length,
    duplicates: existing.size,
    rejected,
    fingerprint: fp,
    suggestedSources: bundle.sources.filter((s) => !known.has(s.id) && !knownUrls.has(s.url)),
  };
}

/** Adds a source someone shared — only after the user taps "Add". */
export async function addSharedSource(s: SharedSource): Promise<void> {
  const src: Source = {
    id: s.id.startsWith('tg.') || s.id.startsWith('user.') ? s.id : `user.${s.id}`,
    name: s.name,
    url: s.url,
    adapter: s.adapter,
    lang: s.lang,
    kind: s.adapter === 'telegram' ? 'telegram' : 'user',
    authority: 'other',
    tier: 'D',
    minIntervalMin: s.adapter === 'html' ? 30 : 15,
    enabled: true,
    builtIn: false,
  };
  await db.sources.put(src);
}

export async function readFileInput(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer());
}
