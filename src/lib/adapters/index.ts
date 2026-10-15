import type { AdapterId, Category, ISO, PlaceRef } from '../model/types';

/** What an adapter extracts from one source response, before normalising. */
export interface Candidate {
  url: string;
  title: string;
  summary: string;
  publishedAt?: ISO;
  /** Adapters that know the exact category and place (e.g. earthquakes) set these. */
  category?: Category;
  places?: PlaceRef[];
}

export class AdapterError extends Error {
  constructor(public code: 'empty' | 'invalid' | 'no-items') {
    super(code);
  }
}

const parser = () => new DOMParser();
/** Parses untrusted HTML without letting <base> tags (blocked by our security policy) apply. */
const parseHtml = (body: string) => parser().parseFromString(body.replace(/<base\b[^>]*>/gi, ''), 'text/html');

/** Plain text from an HTML fragment. Never inserts anything into the page. */
export function htmlToText(html: string): string {
  if (!html) return '';
  const doc = parser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function clip(text: string, max = 300): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + '…';
}

function toIso(s: string | null | undefined): ISO | undefined {
  if (!s) return undefined;
  const t = Date.parse(s.trim());
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

function safeHttpsUrl(u: string | null | undefined, base?: string): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u.trim(), base);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

// ---------- RSS 2.0 and Atom ----------

/** Repairs common real-world feed mistakes: text before the XML header, bare "&", control characters. */
export function repairXml(body: string): string {
  return body
    .replace(/^[\s\uFEFF]+/, '')
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#x[0-9a-fA-F]{1,6});)/g, '&amp;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function parseXml(body: string): Document {
  const strict = parser().parseFromString(body.replace(/^[\s\uFEFF]+/, ''), 'text/xml');
  if (!strict.getElementsByTagName('parsererror').length) return strict;
  const repaired = parser().parseFromString(repairXml(body), 'text/xml');
  if (repaired.getElementsByTagName('parsererror').length) throw new AdapterError('invalid');
  return repaired;
}

export function parseFeed(body: string): Candidate[] {
  if (!body || body.trim().length < 20) throw new AdapterError('empty');
  const doc = parseXml(body);
  const root = doc.documentElement?.nodeName.toLowerCase();
  if (root !== 'rss' && root !== 'feed' && root !== 'rdf:rdf') throw new AdapterError('invalid');

  const out: Candidate[] = [];
  const items = Array.from(doc.getElementsByTagName('item'));
  for (const it of items) {
    const get = (tag: string) => it.getElementsByTagName(tag)[0]?.textContent ?? '';
    const url = safeHttpsUrl(get('link') || get('guid'));
    const title = htmlToText(get('title'));
    if (!url || !title) continue;
    out.push({
      url,
      title: clip(title, 200),
      summary: clip(htmlToText(get('description'))),
      publishedAt: toIso(get('pubDate') || get('dc:date')),
    });
  }
  const entries = Array.from(doc.getElementsByTagName('entry'));
  for (const e of entries) {
    const links = Array.from(e.getElementsByTagName('link'));
    const link = links.find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate') ?? links[0];
    const url = safeHttpsUrl(link?.getAttribute('href'));
    const title = htmlToText(e.getElementsByTagName('title')[0]?.textContent ?? '');
    if (!url || !title) continue;
    const summary =
      e.getElementsByTagName('summary')[0]?.textContent ??
      e.getElementsByTagName('media:description')[0]?.textContent ??
      e.getElementsByTagName('content')[0]?.textContent ??
      '';
    out.push({
      url,
      title: clip(title, 200),
      summary: clip(htmlToText(summary)),
      publishedAt: toIso(
        e.getElementsByTagName('published')[0]?.textContent ?? e.getElementsByTagName('updated')[0]?.textContent,
      ),
    });
  }
  if (!out.length) throw new AdapterError('no-items');
  return out;
}

export function feedTitle(body: string): string | undefined {
  try {
    const doc = parser().parseFromString(body, 'text/xml');
    const t = doc.querySelector('channel > title, feed > title')?.textContent;
    return t ? htmlToText(t) : undefined;
  } catch {
    return undefined;
  }
}

// ---------- Telegram public channel preview (t.me/s/<channel>) ----------

export function telegramChannel(input: string): string | undefined {
  const s = input.trim();
  const m =
    s.match(/^@([A-Za-z0-9_]{4,32})$/) ??
    s.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]{4,32})\/?(?:\?.*)?$/i);
  return m?.[1];
}

export const telegramPreviewUrl = (channel: string) => `https://t.me/s/${channel}`;

export function parseTelegram(body: string): Candidate[] {
  if (!body || body.length < 200) throw new AdapterError('empty');
  const doc = parseHtml(body);
  const msgs = Array.from(doc.querySelectorAll('.tgme_widget_message[data-post]'));
  const out: Candidate[] = [];
  for (const m of msgs) {
    const post = m.getAttribute('data-post');
    if (!post || !/^[A-Za-z0-9_]+\/\d+$/.test(post)) continue;
    const textEl = m.querySelector('.tgme_widget_message_text');
    // Keep line breaks so the first line can become the title.
    textEl?.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    const text = (textEl?.textContent ?? '').replace(/[ \t]+/g, ' ').trim();
    if (!text) continue;
    const first = text.split('\n').find((l) => l.trim().length > 0)?.trim() ?? text;
    out.push({
      url: `https://t.me/${post}`,
      title: clip(first, 160),
      summary: clip(text.replace(/\s+/g, ' ')),
      publishedAt: toIso(m.querySelector('time[datetime]')?.getAttribute('datetime')),
    });
  }
  if (!out.length) throw new AdapterError('no-items');
  return out.reverse(); // newest first
}

export function telegramTitle(body: string): string | undefined {
  const doc = parseHtml(body);
  return doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? undefined;
}

// ---------- Generic web page: headline links ----------

export function findFeedLink(body: string, base: string): string | undefined {
  const doc = parseHtml(body);
  const links = Array.from(
    doc.querySelectorAll('link[rel="alternate"][type="application/rss+xml"], link[rel="alternate"][type="application/atom+xml"]'),
  );
  const main = links.find((l) => !/comment/i.test(l.getAttribute('href') ?? '') && !/koment/i.test(l.getAttribute('title') ?? ''));
  return safeHttpsUrl(main?.getAttribute('href'), base);
}

/**
 * Best-effort extraction of article headlines from an HTML page:
 * links inside <article>, <h1>-<h4>, on the same site, with headline-length text.
 */
export function parseHtmlHeadlines(body: string, base: string): Candidate[] {
  if (!body || body.length < 200) throw new AdapterError('empty');
  const doc = parseHtml(body);
  const host = new URL(base).host.replace(/^www\./, '');
  const seen = new Set<string>();
  const out: Candidate[] = [];
  const anchors = doc.querySelectorAll('article a[href], h1 a[href], h2 a[href], h3 a[href], h4 a[href], a[href] h2, a[href] h3');
  for (const node of Array.from(anchors)) {
    const a = (node.tagName === 'A' ? node : node.closest('a')) as HTMLAnchorElement | null;
    if (!a) continue;
    const url = safeHttpsUrl(a.getAttribute('href'), base);
    if (!url) continue;
    const u = new URL(url);
    if (u.host.replace(/^www\./, '') !== host || u.pathname.length < 8) continue;
    const title = (a.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/^\d{1,2}:\d{2}\s+/, '');
    if (title.length < 25 || title.length > 250) continue;
    const key = u.origin + u.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, title: clip(title, 200), summary: '' });
    if (out.length >= 30) break;
  }
  if (!out.length) throw new AdapterError('no-items');
  return out;
}

// ---------- EMSC earthquakes (FDSN JSON) ----------

interface EmscFeature {
  id?: string;
  properties: { time: string; lat: number; lon: number; mag: number; flynn_region?: string; unid?: string; depth?: number };
}

export function parseEmsc(body: string): Candidate[] {
  if (!body) throw new AdapterError('empty');
  let data: { features?: EmscFeature[] };
  try {
    data = JSON.parse(body);
  } catch {
    throw new AdapterError('invalid');
  }
  const feats = data.features ?? [];
  const out: Candidate[] = [];
  for (const f of feats) {
    const p = f.properties;
    if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
    const id = p.unid ?? f.id;
    if (!id) continue;
    const region = (p.flynn_region ?? '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    out.push({
      url: `https://www.seismicportal.eu/eventdetails.html?unid=${encodeURIComponent(id)}`,
      title: `M${p.mag.toFixed(1)} – ${region}`,
      summary: `Magnitude ${p.mag.toFixed(1)}, depth ${Math.round(p.depth ?? 0)} km, ${region}.`,
      publishedAt: toIso(p.time),
      category: 'hazard',
      places: [{ name: region, gazetteerId: `emsc:${id}`, lat: p.lat, lon: p.lon, precision: 'city' }],
    });
  }
  return out;
}

export function parseBySource(adapter: AdapterId, body: string, sourceUrl: string): Candidate[] {
  switch (adapter) {
    case 'rss':
      return parseFeed(body);
    case 'telegram':
      return parseTelegram(body);
    case 'html':
      return parseHtmlHeadlines(body, sourceUrl);
    case 'emsc':
      return parseEmsc(body);
  }
}
