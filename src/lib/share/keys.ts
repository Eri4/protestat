import { db, getSetting, setSetting, type ProtestatDB } from '../store/db';
import { fingerprint, generateKeys, publicKeyB64 } from './bundle';

/** This phone's signing keys. Random, never linked to a person; can be regenerated in Settings. */
export async function getKeys(target: ProtestatDB = db): Promise<CryptoKeyPair> {
  const saved = await getSetting<CryptoKeyPair | null>('keys', null, target);
  if (saved?.privateKey) return saved;
  const keys = await generateKeys();
  await setSetting('keys', keys, target);
  return keys;
}

export async function myPublicKey(target: ProtestatDB = db): Promise<string> {
  return publicKeyB64((await getKeys(target)).publicKey);
}

export async function myFingerprint(): Promise<string> {
  return fingerprint(await myPublicKey());
}

export async function regenerateKeys(): Promise<void> {
  await setSetting('keys', await generateKeys());
}
