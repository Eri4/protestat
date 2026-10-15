import {
  feedTitle,
  findFeedLink,
  parseFeed,
  parseHtmlHeadlines,
  parseTelegram,
  telegramChannel,
  telegramPreviewUrl,
  telegramTitle,
  type Candidate,
} from '../adapters';
import { httpGet } from '../engine/fetcher';
import { isDisallowed } from '../engine/robots';
import { sha256, canonicalUrl } from '../engine/normalize';
import { classify } from '../engine/classify';
import { findPlaces } from '../geo/gazetteer';
import { SCHEMA_VERSION, type Category, type PlaceRef, type Report, type Source } from '../model/types';

export interface SourcePreview {
  source: Source;
  items: Candidate[];
}

const shortHash = async (s: string) => (await sha256(s)).slice(0, 10);

/**
 * Works out what the user typed — a Telegram channel, an RSS/Atom feed, or a web page —
 * fetches it once and returns a preview. Nothing is saved until the user confirms.
 */
/** Refuses sources whose robots.txt forbids automated reading of that path. */
async function assertRobotsAllow(url: string): Promise<void> {
  const u = new URL(url);
  try {
    const r = await httpGet(`${u.origin}/robots.txt`, { timeoutMs: 8000 });
    if (r.status === 200 && isDisallowed(r.body, u.pathname + u.search)) throw new Error('robots');
  } catch (e) {
    if (e instanceof Error && e.message === 'robots') throw e;
    /* no robots.txt reachable: allowed */
  }
}

export async function previewSource(input: string): Promise<SourcePreview> {
  const raw = input.trim();
  const channel = telegramChannel(raw);
  if (channel) {
    const url = telegramPreviewUrl(channel);
    const res = await httpGet(url);
    if (res.status !== 200) throw new Error(`http-${res.status}`);
    const items = parseTelegram(res.body); // throws no-items for private/empty channels
    return {
      source: base({
        id: `tg.${channel.toLowerCase()}`,
        name: telegramTitle(res.body) ?? `@${channel}`,
        kind: 'telegram',
        url,
        adapter: 'telegram',
      }),
      items: items.slice(0, 5),
    };
  }

  const url = /^https?:\/\//i.test(raw) ? raw.replace(/^http:/i, 'https:') : `https://${raw}`;
  new URL(url); // throws on nonsense
  await assertRobotsAllow(url);
  const res = await httpGet(url);
  if (res.status !== 200) throw new Error(`http-${res.status}`);
  const looksXml = /^\s*(<\?xml|<rss|<feed|<rdf)/i.test(res.body);
  if (looksXml) {
    const items = parseFeed(res.body);
    return {
      source: base({ id: `user.${await shortHash(url)}`, name: feedTitle(res.body) ?? new URL(url).host, kind: 'user', url, adapter: 'rss' }),
      items: items.slice(0, 5),
    };
  }
  // A web page: prefer its own RSS feed if it advertises one.
  const feed = findFeedLink(res.body, url);
  if (feed) {
    try {
      await assertRobotsAllow(feed);
      const fr = await httpGet(feed);
      const items = parseFeed(fr.body);
      return {
        source: base({ id: `user.${await shortHash(feed)}`, name: feedTitle(fr.body) ?? new URL(url).host, kind: 'user', url: feed, adapter: 'rss' }),
        items: items.slice(0, 5),
      };
    } catch {
      /* fall back to reading headlines from the page */
    }
  }
  const items = parseHtmlHeadlines(res.body, url);
  const title = new DOMParser().parseFromString(res.body.replace(/<base\b[^>]*>/gi, ''), 'text/html').title.trim();
  return {
    source: base({
      id: `user.${await shortHash(url)}`,
      name: title.slice(0, 60) || new URL(url).host,
      kind: 'user',
      url,
      adapter: 'html',
      minIntervalMin: 30,
    }),
    items: items.slice(0, 5),
  };
}

function base(s: Pick<Source, 'id' | 'name' | 'kind' | 'url' | 'adapter'> & Partial<Source>): Source {
  return {
    authority: 'other',
    tier: 'D',
    lang: 'sq',
    minIntervalMin: 15,
    enabled: true,
    builtIn: false,
    ...s,
  };
}

// ---------- Links pasted by the user (TikTok, Instagram, Facebook, X, YouTube, any page) ----------

export type Platform = 'tiktok' | 'instagram' | 'facebook' | 'youtube' | 'x' | 'telegram' | 'web';

export function detectPlatform(url: string): Platform {
  const h = new URL(url).host.replace(/^www\.|^m\./, '');
  if (/tiktok\.com$/.test(h)) return 'tiktok';
  if (/instagram\.com$/.test(h)) return 'instagram';
  if (/facebook\.com$|fb\.watch$/.test(h)) return 'facebook';
  if (/youtube\.com$|youtu\.be$/.test(h)) return 'youtube';
  if (/(^|\.)x\.com$|twitter\.com$/.test(h)) return 'x';
  if (/t\.me$/.test(h)) return 'telegram';
  return 'web';
}

const OEMBED: Partial<Record<Platform, (u: string) => string>> = {
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
};

/** Public title/author for a pasted link where the platform offers it without a key. */
export async function linkMetadata(url: string): Promise<{ title?: string; author?: string; platform: Platform }> {
  const platform = detectPlatform(url);
  const ep = OEMBED[platform];
  if (!ep) return { platform };
  try {
    const res = await httpGet(ep(url), { timeoutMs: 8000 });
    if (res.status !== 200) return { platform };
    const j = JSON.parse(res.body) as { title?: string; author_name?: string };
    return { platform, title: j.title?.slice(0, 200), author: j.author_name?.slice(0, 80) };
  } catch {
    return { platform };
  }
}

export const USER_SOURCE_ID = 'user.links';

export async function makeLinkReport(input: {
  url: string;
  title: string;
  note: string;
  category?: Category;
  place?: PlaceRef;
  seenAt?: string;
  /** Known social account the post came from, e.g. "JOQ Albania". */
  accountName?: string;
}): Promise<Report> {
  const canon = canonicalUrl(input.url);
  const text = `${input.title}. ${input.note}`;
  const platform = detectPlatform(input.url);
  return {
    id: (await sha256(`${USER_SOURCE_ID}|${canon}`)).slice(0, 32),
    sourceId: USER_SOURCE_ID,
    sourceName: input.accountName
      ? `${input.accountName} (${platform})`
      : platform === 'web'
        ? new URL(input.url).host
        : platform,
    url: input.url,
    canonicalUrl: canon,
    title: input.title.slice(0, 200),
    summary: input.note.slice(0, 300),
    lang: 'sq',
    // The time the user says they saw it — never presented as the event time.
    publishedAt: input.seenAt,
    collectedAt: new Date().toISOString(),
    places: input.place ? [input.place] : findPlaces(text),
    category: input.category ?? classify(text, 'user'),
    categoryBy: input.category ? 'user' : 'rule',
    contentHash: (await sha256(canon)).slice(0, 32),
    denial: false,
    provenance: { origin: 'user' },
    schemaVersion: SCHEMA_VERSION,
  };
}

export const USER_LINKS_SOURCE: Source = {
  id: USER_SOURCE_ID,
  name: 'Lidhjet e mia / My links',
  kind: 'user',
  authority: 'other',
  tier: 'D',
  url: 'about:user',
  adapter: 'rss',
  lang: 'sq',
  minIntervalMin: 99999,
  enabled: false,
  builtIn: true,
};

export const CROWD_SOURCE_ID = 'crowd';

/** Pseudo-source for reports made by people with the app ("I saw police here"). */
export const CROWD_SOURCE: Source = {
  id: CROWD_SOURCE_ID,
  name: 'Raporte nga njerëzit / People reports',
  kind: 'user',
  authority: 'other',
  tier: 'D',
  url: 'about:crowd',
  adapter: 'rss',
  lang: 'sq',
  minIntervalMin: 99999,
  enabled: false,
  builtIn: true,
};
