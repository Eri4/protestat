import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { USER_AGENT } from '../config';

export interface FetchResult {
  status: number;
  body: string;
  etag?: string;
  lastModified?: string;
  contentType?: string;
}

export interface FetchOptions {
  etag?: string;
  lastModified?: string;
  timeoutMs?: number;
  /** Allow plain http, but only to private local addresses (a phone on the same Wi-Fi or hotspot). */
  allowLan?: boolean;
}

/** 10.x, 172.16-31.x, 192.168.x, 127.x, localhost and *.local — never the open internet. */
export function isPrivateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function checkUrl(url: string, allowLan?: boolean) {
  const u = new URL(url);
  if (u.protocol === 'https:') return;
  if (u.protocol === 'http:' && allowLan && isPrivateHost(u.hostname)) return;
  throw new Error('only-https');
}

const MAX_BYTES = 2_000_000;

function header(h: Record<string, string> | Headers, name: string): string | undefined {
  if (h instanceof Headers) return h.get(name) ?? undefined;
  const key = Object.keys(h).find((k) => k.toLowerCase() === name);
  return key ? h[key] : undefined;
}

export const isNative = () => Capacitor.isNativePlatform();

/**
 * GET a public URL. On the phone app this uses native networking (no CORS limits);
 * in a browser (PWA) it uses fetch and only works for sources that allow CORS.
 */
export async function httpGet(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  checkUrl(url, opts.allowLan);
  const headers: Record<string, string> = {};
  if (opts.etag) headers['If-None-Match'] = opts.etag;
  if (opts.lastModified) headers['If-Modified-Since'] = opts.lastModified;
  const timeout = opts.timeoutMs ?? 15000;

  if (isNative()) {
    headers['User-Agent'] = USER_AGENT;
    const res = await CapacitorHttp.request({
      url,
      method: 'GET',
      headers,
      responseType: 'text',
      connectTimeout: timeout,
      readTimeout: timeout,
    });
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
    return {
      status: res.status,
      body: body.slice(0, MAX_BYTES),
      etag: header(res.headers, 'etag'),
      lastModified: header(res.headers, 'last-modified'),
      contentType: header(res.headers, 'content-type'),
    };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, cache: 'no-cache' });
    const body = res.status === 304 ? '' : (await res.text()).slice(0, MAX_BYTES);
    return {
      status: res.status,
      body,
      etag: header(res.headers, 'etag'),
      lastModified: header(res.headers, 'last-modified'),
      contentType: header(res.headers, 'content-type'),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** POST a JSON body (used only by the optional group sync). */
export async function httpPostJson(url: string, body: unknown, opts: FetchOptions = {}): Promise<FetchResult> {
  checkUrl(url, opts.allowLan);
  const timeout = opts.timeoutMs ?? 20000;
  const json = JSON.stringify(body);
  if (isNative()) {
    const res = await CapacitorHttp.request({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      data: json,
      responseType: 'text',
      connectTimeout: timeout,
      readTimeout: timeout,
    });
    return { status: res.status, body: typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '') };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, signal: ctrl.signal });
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}
