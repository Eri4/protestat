import { describe, expect, it } from 'vitest';
import {
  AdapterError,
  findFeedLink,
  parseEmsc,
  parseFeed,
  parseHtmlHeadlines,
  parseTelegram,
  telegramChannel,
} from '../src/lib/adapters';
import { fixture } from './helpers';

describe('RSS / Atom', () => {
  it('parses the Balkanweb feed', () => {
    const items = parseFeed(fixture('balkanweb.xml'));
    expect(items).toHaveLength(10);
    for (const i of items) {
      expect(i.url).toMatch(/^https:\/\/www\.balkanweb\.com\//);
      expect(i.title.length).toBeGreaterThan(5);
      expect(i.summary.length).toBeLessThanOrEqual(300);
      expect(i.publishedAt).toMatch(/^2026-10-1/);
      expect(i.title).not.toMatch(/<|&#8211;/);
    }
  });
  it('parses the State Police and Faktoje feeds', () => {
    expect(parseFeed(fixture('asp.xml')).length).toBeGreaterThan(5);
    expect(parseFeed(fixture('faktoje.xml')).length).toBeGreaterThan(5);
  });
  it('parses Atom (YouTube channel feed)', () => {
    const items = parseFeed(fixture('atom-youtube.xml'));
    expect(items.length).toBeGreaterThan(5);
    expect(items[0].url).toMatch(/youtube\.com\/(watch|shorts)/);
  });
  it('repairs broken real-world feeds (Bota Sot bare "&", Gazeta Express text before the header)', () => {
    expect(parseFeed(fixture('botasot-broken.xml')).length).toBeGreaterThan(5);
    expect(parseFeed(fixture('gazetaexpress-leading-space.xml')).length).toBeGreaterThan(5);
  });
  it('treats the empty police response seen in testing as a failure', () => {
    expect(() => parseFeed(fixture('asp-empty.xml'))).toThrow(AdapterError);
    expect(() => parseFeed('<html><body>Just a moment...</body></html>')).toThrow(AdapterError);
  });
});

describe('Telegram', () => {
  it('recognises channel names and links', () => {
    expect(telegramChannel('@durov')).toBe('durov');
    expect(telegramChannel('https://t.me/durov')).toBe('durov');
    expect(telegramChannel('t.me/s/durov')).toBe('durov');
    expect(telegramChannel('https://example.com')).toBeUndefined();
  });
  it('parses the public channel preview', () => {
    const items = parseTelegram(fixture('telegram-durov.html'));
    expect(items.length).toBeGreaterThan(5);
    expect(items[0].url).toMatch(/^https:\/\/t\.me\/durov\/\d+$/);
    expect(items[0].publishedAt).toBeTruthy();
    expect(Date.parse(items[0].publishedAt!)).toBeGreaterThanOrEqual(Date.parse(items[items.length - 1].publishedAt!));
  });
});

describe('Web pages', () => {
  it('finds the advertised RSS feed, ignoring the comments feed', () => {
    expect(findFeedLink(fixture('euronews-home.html'), 'https://euronews.al/')).toBe('https://euronews.al/feed/');
  });
  it('extracts headline links from a page', () => {
    const items = parseHtmlHeadlines(fixture('euronews-home.html'), 'https://euronews.al/');
    expect(items.length).toBeGreaterThan(5);
    for (const i of items) expect(new URL(i.url).host).toMatch(/euronews\.al$/);
  });
});

describe('EMSC earthquakes', () => {
  it('turns events into located hazard candidates', () => {
    const items = parseEmsc(fixture('emsc.json'));
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].category).toBe('hazard');
    expect(items[0].places![0].lat).toBeGreaterThan(38);
    expect(items[0].title).toMatch(/^M\d\.\d/);
  });
});
