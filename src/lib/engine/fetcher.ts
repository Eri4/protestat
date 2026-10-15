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
  if (!/^https:\/\//i.test(url)) throw new Error('only-https');
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
