import { registerPlugin } from '@capacitor/core';
import { isNative } from '../engine/fetcher';

/** Native Android plugin that runs the relay on this phone (see RelayHostPlugin.java). */
interface RelayHostPlugin {
  start(opts: { port: number }): Promise<{ port: number; addresses: string[] }>;
  stop(): Promise<void>;
  status(): Promise<{ running: boolean; port: number; addresses: string[]; items: number }>;
}

const RelayHost = registerPlugin<RelayHostPlugin>('RelayHost');

export const HOST_PORT = 8787;
export const canHostHere = () => isNative() && navigator.userAgent.includes('Android');

export async function startHosting(): Promise<{ port: number; addresses: string[] }> {
  return RelayHost.start({ port: HOST_PORT });
}

export async function stopHosting(): Promise<void> {
  await RelayHost.stop();
}

export async function hostStatus(): Promise<{ running: boolean; port: number; addresses: string[]; items: number }> {
  if (!canHostHere()) return { running: false, port: 0, addresses: [], items: 0 };
  try {
    return await RelayHost.status();
  } catch {
    return { running: false, port: 0, addresses: [], items: 0 };
  }
}
