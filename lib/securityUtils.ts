import { equal } from '@stablelib/constant-time';

export const encoder = new TextEncoder();

export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  const aBuf = new Uint8Array(len);
  const bBuf = new Uint8Array(len);
  aBuf.set(aBytes);
  bBuf.set(bBytes);
  return equal(aBuf, bBuf) && aBytes.length === bBytes.length;
}

export async function hashSessionId(id: string): Promise<string> {
  const data = encoder.encode(id);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
