// A sync group = a server address + a secret key. The key never leaves the phones in readable form:
// everything is encrypted (AES-GCM 256) before upload, so the server only stores scrambled blobs.

export interface GroupInfo {
  /** Server base URL, e.g. https://relay.example.org or http://192.168.43.1:8787 */
  server: string;
  /** 32-byte group key, base64url. Whoever has it can read and share in the group. */
  key: string;
  /** Optional friendly name shown to members. */
  name: string;
}

const enc = new TextEncoder();
const b64url = (u8: Uint8Array) => {
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const b64 = (u8: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function newGroupKey(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** The mailbox id on the server: derived from the key, so it reveals nothing about it. */
export async function groupId(key: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`protestat-group|${key}`)));
  return b64url(h).slice(0, 32);
}

async function aesKey(key: string): Promise<CryptoKey> {
  const raw = unb64url(key);
  if (raw.length !== 32) throw new Error('bad-key');
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(key: string, data: Uint8Array): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(key), data as BufferSource));
  return { iv: b64(iv), data: b64(ct) };
}

export async function open(key: string, blob: { iv: string; data: string }): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) as BufferSource }, await aesKey(key), unb64(blob.data) as BufferSource);
  return new Uint8Array(pt);
}

// ---- join code ----
// protestat://join?s=<server>&k=<key>&n=<name>   (also accepted inside any pasted text)

export function joinLink(g: GroupInfo): string {
  const q = new URLSearchParams({ s: g.server, k: g.key });
  if (g.name) q.set('n', g.name);
  return `protestat://join?${q.toString()}`;
}

export function normaliseServer(input: string): string {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  const u = new URL(s);
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
}

export function parseJoin(text: string): GroupInfo | null {
  const m = text.match(/protestat:\/\/join\?[^\s"'<>]+/);
  if (!m) return null;
  try {
    const q = new URLSearchParams(m[0].slice(m[0].indexOf('?') + 1));
    const server = q.get('s');
    const key = q.get('k');
    if (!server || !key || unb64url(key).length !== 32) return null;
    return { server: normaliseServer(server), key, name: (q.get('n') ?? '').slice(0, 60) };
  } catch {
    return null;
  }
}
