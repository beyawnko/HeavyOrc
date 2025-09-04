import { equal } from '@stablelib/constant-time';

export const encoder = new TextEncoder();

export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return equal(encoder.encode(a), encoder.encode(b));
}

export async function hashSessionId(id: string): Promise<string> {
  const data = encoder.encode(id);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
