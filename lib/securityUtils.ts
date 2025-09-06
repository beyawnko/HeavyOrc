import { equal } from '@stablelib/constant-time';

export const encoder = new TextEncoder();

export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  return equal(aBytes, bBytes);
}

export function secureRandomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buf);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('crypto').randomFillSync(buf);
  }
  return buf;
}

export function secureRandom(): number {
  const bytes = secureRandomBytes(4);
  const value =
    (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  return (value >>> 0) / 0x100000000;
}

export async function hashKey(id: string): Promise<string> {
  const data = encoder.encode(id);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const hashSessionId = hashKey;
