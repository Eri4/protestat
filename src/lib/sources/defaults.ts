import { TIER_AUTHORITY, type AdapterId, type Source, type SourceKind, type Tier } from '../model/types';

// The built-in catalogue. Every entry was checked on 2026-10-16:
//  - it answered with a working feed (or a page with readable headlines),
//  - its robots.txt does not forbid generic crawlers from that path.
// Left out on purpose:
//  - robots.txt forbids it: Balkan Insight, Bota.al, Radio Evropa e Lirë (/api/), Monitor.
//  - blocks automated access: Top Channel feed, A2 CNN, Ora News, Gazeta Tema, CNA, Sot, Politiko (Cloudflare 403).
//  - inactive: Insajderi (2023), Zëri i Amerikës (2025), 27.al.
//
// Tier = the project's trust benchmark (see the Guides page). It is an editorial judgement that anyone
// can challenge in the open-source repository, not a verdict on any outlet:
//  A  official body speaking for itself (Police, seismic service, municipality)
//  B  established newsroom: known owner and editors, original reporting, corrects mistakes
//  C  portal, aggregator, tabloid or social-first outlet: mostly reposts, anonymous or sensational
//  D  unverified: sources you add yourself, Telegram channels, people's reports

interface Def {
  id: string;
  name: string;
  kind: SourceKind;
  tier: Tier;
  url: string;
  adapter: AdapterId;
  region: Source['region'];
  lang?: string;
  family?: string;
  enabled?: boolean;
  minIntervalMin?: number;
}

const rss = (id: string, name: string, tier: Tier, url: string, region: Source['region'], more: Partial<Def> = {}): Def => ({
  id,
  name,
  kind: more.kind ?? 'news',
  tier,
  url,
  adapter: 'rss',
  region,
  ...more,
});
const page = (id: string, name: string, tier: Tier, url: string, region: Source['region'], more: Partial<Def> = {}): Def => ({
  id,
  name,
  kind: more.kind ?? 'news',
  tier,
  url,
  adapter: 'html',
  region,
  minIntervalMin: 30,
  ...more,
});

const DEFS: Def[] = [
  // ---- A · official ----
  rss('al.asp', 'Policia e Shtetit', 'A', 'https://www.asp.gov.al/feed/', 'AL', { kind: 'police', minIntervalMin: 15 }),
  { id: 'eu.emsc', name: 'EMSC – Tërmetet / Earthquakes', kind: 'hazard', tier: 'A', url: 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minlat=39&maxlat=43.2&minlon=18.5&maxlon=21.6&minmag=2.5&limit=30&orderby=time', adapter: 'emsc', region: 'INT', lang: 'en' },
  page('al.tirana', 'Bashkia e Tiranës', 'A', 'https://www.tirana.al/', 'AL', { kind: 'official', minIntervalMin: 60 }),

  // ---- B · established newsrooms (Albania) ----
  rss('al.rtsh', 'RTSH', 'B', 'https://www.rtsh.al/feed/', 'AL'),
  rss('al.ata', 'ATA – Agjencia Telegrafike Shqiptare', 'B', 'https://www.ata.gov.al/feed/', 'AL'),
  rss('al.balkanweb', 'Balkanweb / News24', 'B', 'https://www.balkanweb.com/feed/', 'AL', { family: 'focus-media' }),
  rss('al.gazetashqiptare', 'Gazeta Shqiptare', 'B', 'https://www.gazetashqiptare.al/feed/', 'AL', { family: 'focus-media' }),
  rss('al.euronews', 'Euronews Albania', 'B', 'https://euronews.al/feed/', 'AL'),
  rss('al.abcnews', 'ABC News Albania', 'B', 'https://abcnews.al/feed/', 'AL'),
  rss('al.vizionplus', 'Vizion Plus', 'B', 'https://www.vizionplus.tv/feed/', 'AL'),
  page('al.reporttv', 'Report TV', 'B', 'https://report-tv.al/', 'AL', { family: 'shqiptarja' }),
  page('al.shqiptarja', 'Shqiptarja.com', 'B', 'https://shqiptarja.com/', 'AL', { family: 'shqiptarja', enabled: false }),
  page('al.tvklan', 'TV Klan', 'B', 'https://tvklan.al/', 'AL', { enabled: false, minIntervalMin: 60 }),
  rss('al.panorama', 'Panorama', 'B', 'https://www.panorama.com.al/feed/', 'AL'),
  rss('al.kohajone', 'Koha Jonë', 'B', 'https://kohajone.com/feed/', 'AL'),
  rss('al.standard', 'Gazeta Standard', 'B', 'https://www.standard.al/feed/', 'AL'),
  page('al.mapo', 'Gazeta Mapo', 'B', 'https://mapo.al/', 'AL'),
  page('al.exit', 'Exit News', 'B', 'https://exit.al/', 'AL'),
  rss('al.reporter', 'Reporter.al (BIRN)', 'B', 'https://www.reporter.al/feed/', 'AL', { family: 'birn', minIntervalMin: 30 }),
  rss('al.faktoje', 'Faktoje (verifikim faktesh)', 'B', 'https://faktoje.al/feed/', 'AL', { kind: 'factcheck', minIntervalMin: 30 }),
  rss('al.acqj', 'ACQJ – Qendra për Çështje të Gazetarisë', 'B', 'https://acqj.al/feed/', 'AL', { minIntervalMin: 60 }),
  rss('al.tiranatimes', 'Tirana Times (EN)', 'B', 'https://www.tiranatimes.com/feed/', 'AL', { lang: 'en', minIntervalMin: 30 }),
  page('al.albaniandailynews', 'Albanian Daily News (EN)', 'B', 'https://albaniandailynews.com/', 'AL', { lang: 'en', minIntervalMin: 60 }),

  // ---- B · established newsrooms (Kosovo, North Macedonia, regional) ----
  rss('xk.koha', 'Koha.net', 'B', 'https://www.koha.net/rss', 'XK'),
  rss('xk.gazetaexpress', 'Gazeta Express', 'B', 'https://www.gazetaexpress.com/feed/', 'XK'),
  rss('xk.telegrafi', 'Telegrafi', 'B', 'https://telegrafi.com/feeds/feed.rss', 'XK'),
  rss('xk.zeri', 'Zëri', 'B', 'https://zeri.info/rss', 'XK'),
  rss('xk.epokaere', 'Epoka e Re', 'B', 'https://www.epokaere.com/feed/', 'XK'),
  rss('xk.botasot', 'Bota Sot', 'B', 'https://www.botasot.info/rss', 'XK'),
  rss('xk.kallxo', 'Kallxo.com (BIRN Kosovë)', 'B', 'https://kallxo.com/feed/', 'XK', { family: 'birn', minIntervalMin: 30 }),
  rss('xk.dukagjini', 'Dukagjini', 'B', 'https://www.dukagjini.com/feed/', 'XK'),
  page('xk.rtk', 'RTK Live', 'B', 'https://www.rtklive.com/', 'XK'),
  page('xk.klankosova', 'Klan Kosova', 'B', 'https://klankosova.tv/', 'XK'),
  rss('mk.alsat', 'Alsat', 'B', 'https://alsat.mk/feed/', 'MK'),
  rss('mk.portalb', 'Portalb.mk', 'B', 'https://portalb.mk/feed/', 'MK'),
  rss('eu.birn', 'BIRN Network', 'B', 'https://birn.eu.com/feed/', 'INT', { family: 'birn', lang: 'en', minIntervalMin: 60 }),

  // ---- C · portals, aggregators, tabloids, social-first ----
  page('al.joq', 'JOQ Albania', 'C', 'https://joq-albania.com/', 'AL'),
  page('al.lapsi', 'Lapsi.al', 'C', 'https://lapsi.al/', 'AL'),
  page('al.syri', 'Syri.net', 'C', 'https://syri.net/', 'AL'),
  page('al.telegraf', 'Gazeta Telegraf', 'C', 'https://telegraf.al/', 'AL'),
  page('al.shekulli', 'Shekulli', 'C', 'https://shekulli.com.al/', 'AL'),
  page('al.gazetashqip', 'Gazeta Shqip', 'C', 'https://gazeta-shqip.com/', 'AL'),
  page('al.hashtag', 'Hashtag.al', 'C', 'https://hashtag.al/', 'AL', { enabled: false }),
  rss('al.javanews', 'Javanews', 'C', 'https://www.javanews.al/feed/', 'AL'),
  rss('al.shqipcom', 'Shqip.com', 'C', 'https://shqip.com/feed/', 'AL'),
  rss('al.droni', 'Droni.al', 'C', 'https://droni.al/feed/', 'AL'),
  rss('al.faxweb', 'Faxweb', 'C', 'https://faxweb.al/feed/', 'AL'),
  rss('al.impakt', 'Gazeta Impakt', 'C', 'https://gazetaimpakt.com/feed/', 'AL'),
  rss('al.albeu', 'Albeu (agregator)', 'C', 'https://albeu.com/feed/', 'AL'),
  rss('al.lajme', 'Lajme.al', 'C', 'https://www.lajme.al/feed/', 'AL', { enabled: false }),
  rss('al.news24', 'News24 (faqja e vjetër)', 'C', 'https://www.news24.al/feed/', 'AL', { family: 'focus-media', enabled: false }),
  rss('xk.indeksonline', 'Indeksonline', 'C', 'https://indeksonline.net/feed/', 'XK'),
  rss('xk.lajmi', 'Lajmi.net', 'C', 'https://lajmi.net/feed/', 'XK'),
  rss('xk.periskopi', 'Periskopi', 'C', 'https://periskopi.com/sq/rss.xml', 'XK'),
  rss('xk.ekonomia', 'Ekonomia Online', 'C', 'https://ekonomiaonline.com/feed/', 'XK', { enabled: false }),
  page('xk.albanianpost', 'Albanian Post', 'C', 'https://albanianpost.com/', 'XK', { enabled: false }),
];

export function defaultSources(): Source[] {
  return DEFS.map((d) => ({
    lang: 'sq',
    minIntervalMin: 10,
    enabled: true,
    builtIn: true,
    authority: TIER_AUTHORITY[d.tier],
    ...d,
  }));
}

// ---- Social media accounts ----
// Instagram, Facebook, TikTok and X don't allow apps to read accounts without approved API access,
// so these can't be collected automatically. The app lists them (with the same trust tier) so people
// can open them and save individual posts as links. Handles were taken from each outlet's own website.

export type SocialPlatform = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'x';

export interface SocialAccount {
  name: string;
  platform: SocialPlatform;
  handle: string;
  tier: Tier;
}

const S = (name: string, tier: Tier, accounts: Partial<Record<SocialPlatform, string>>): SocialAccount[] =>
  Object.entries(accounts).map(([platform, handle]) => ({ name, tier, platform: platform as SocialPlatform, handle: handle! }));

export const SOCIAL_ACCOUNTS: SocialAccount[] = [
  ...S('Policia e Shtetit', 'A', { instagram: 'policiae_shtetit' }),
  ...S('Bashkia e Tiranës', 'A', { instagram: 'bashkiatirane' }),
  ...S('RTSH', 'B', { instagram: 'rtshqiptar', tiktok: 'rtshqiptar' }),
  ...S('Top Channel', 'B', { instagram: 'topchannelalbania' }),
  ...S('TV Klan', 'B', { instagram: 'rtvklan' }),
  ...S('Euronews Albania', 'B', { instagram: 'euronews_albania' }),
  ...S('ABC News Albania', 'B', { instagram: 'abcnewsal', tiktok: 'abcnews_al' }),
  ...S('Vizion Plus', 'B', { instagram: 'vizionplustv', tiktok: 'vizionplustv' }),
  ...S('Balkanweb', 'B', { instagram: 'balkanweb_official' }),
  ...S('News24', 'B', { instagram: 'news24al' }),
  ...S('Shqiptarja / Report TV', 'B', { instagram: 'shqiptarjacom' }),
  ...S('Reporter.al', 'B', { instagram: 'reporteralbania' }),
  ...S('Faktoje', 'B', { instagram: 'faktoje.al', tiktok: 'faktoje.al' }),
  ...S('Exit News', 'B', { instagram: 'theexitalbania' }),
  ...S('Gazeta Express', 'B', { instagram: 'gazetaexpress' }),
  ...S('Klan Kosova', 'B', { instagram: 'klankosovaofficial', tiktok: 'klankosovaofficial' }),
  ...S('RTK', 'B', { instagram: 'rtklivecom' }),
  ...S('RTV21', 'B', { instagram: 'rtv21', tiktok: 'rtv21' }),
  ...S('Kallxo', 'B', { instagram: 'kallxo_com' }),
  ...S('JOQ Albania', 'C', { instagram: 'joqalbania', facebook: 'joqalbania', x: 'JoqAlbania' }),
  ...S('Lapsi.al', 'C', { instagram: 'lapsi.al', tiktok: 'lapsivideos' }),
  ...S('Shqip.com', 'C', { instagram: 'shqip_com', tiktok: 'shqip.com' }),
  ...S('Lajmi.net', 'C', { instagram: 'lajminet' }),
  ...S('Periskopi', 'C', { instagram: 'periskopi', tiktok: 'periskopi' }),
  ...S('Gazeta Shqip', 'C', { instagram: 'gazeta_shqip' }),
  ...S('Bota Sot', 'B', { instagram: 'bota_sot' }),
];

export function socialUrl(a: Pick<SocialAccount, 'platform' | 'handle'>): string {
  switch (a.platform) {
    case 'instagram':
      return `https://www.instagram.com/${a.handle}/`;
    case 'tiktok':
      return `https://www.tiktok.com/@${a.handle}`;
    case 'facebook':
      return `https://www.facebook.com/${a.handle}`;
    case 'youtube':
      return `https://www.youtube.com/${a.handle}`;
    case 'x':
      return `https://x.com/${a.handle}`;
  }
}

/** Finds the known account a pasted post link belongs to (TikTok and most X/Facebook links include the handle). */
export function accountForUrl(url: string): SocialAccount | undefined {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^(www|m)\./, '');
    const first = u.pathname.split('/').filter(Boolean)[0]?.replace(/^@/, '').toLowerCase();
    if (!first) return undefined;
    const platform: SocialPlatform | undefined = /instagram\.com$/.test(host)
      ? 'instagram'
      : /tiktok\.com$/.test(host)
        ? 'tiktok'
        : /facebook\.com$/.test(host)
          ? 'facebook'
          : /(^|\.)x\.com$|twitter\.com$/.test(host)
            ? 'x'
            : undefined;
    return SOCIAL_ACCOUNTS.find((a) => a.platform === platform && a.handle.toLowerCase() === first);
  } catch {
    return undefined;
  }
}
