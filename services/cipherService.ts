import { RunRecord } from '@/types';
import { fetchWithRetry } from '@/services/llmService';
import { sanitizeErrorResponse } from '@/lib/security';

export interface MemoryEntry {
  id: string;
  content: string;
}

const useCipher = import.meta.env.VITE_USE_CIPHER_MEMORY === 'true';
const baseUrl = validateUrl(import.meta.env.VITE_CIPHER_SERVER_URL, import.meta.env.DEV);

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute
let tokens = MAX_REQUESTS;
let lastRefill = Date.now();

function consumeToken(): boolean {
  const now = Date.now();
  const elapsed = now - lastRefill;
  if (elapsed > 0) {
    tokens = Math.min(MAX_REQUESTS, tokens + (elapsed / RATE_LIMIT_WINDOW) * MAX_REQUESTS);
    lastRefill = now;
  }
  if (tokens < 1) return false;
  tokens -= 1;
  return true;
}

export function validateUrl(url: string | undefined, dev: boolean = import.meta.env.DEV): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) && (dev || !isPrivateOrLocalhost(parsed.hostname)) ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Detects private network or localhost hostnames.
 * TODO: Consider replacing with a vetted library to reduce edge-case risk.
 */
function isPrivateOrLocalhost(hostname: string): boolean {
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower === '::1' || lower === '::') return true;
  if (lower.startsWith('127.') || lower.startsWith('192.168.') || lower.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower)) return true;
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice(7);
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(mapped)) {
      if (isPrivateOrLocalhost(mapped)) return true;
    } else {
      const parts = mapped.split(':');
      if (parts.length === 2 && parts.every(p => /^[0-9a-f]{1,4}$/.test(p))) {
        const [a, b] = parts.map(p => parseInt(p, 16));
        const ipv4 = `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
        if (isPrivateOrLocalhost(ipv4)) return true;
      }
    }
  }
  return /^fe[89ab][0-9a-f]*:/.test(lower) ||
    /^f[cd][0-9a-f]*:/.test(lower);
}

export const storeRunRecord = async (run: RunRecord): Promise<void> => {
  if (!useCipher || !baseUrl) return;
  try {
    const response = await fetchWithRetry(`${baseUrl}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run }),
    });
    const csp = response.headers.get('Content-Security-Policy');
    const directives = ['default-src', 'script-src', 'style-src', 'img-src', 'connect-src'];
    const valid =
      csp && directives.every(d => new RegExp(`\\b${d}\\s+'self'(?:\\s|;|$)`).test(csp));
    if (!valid) {
      console.error('Invalid or insufficient CSP headers from memory server');
      return;
    }
    if (!response.ok) {
      const errorData = await response.text().catch(() => 'Unable to read error response');
      console.error('Failed to store run record', {
        url: `${baseUrl}/memories`,
        status: response.status,
        statusText: response.statusText,
        body: sanitizeErrorResponse(errorData),
      });
    }
  } catch (e) {
    console.error('Failed to store run record', {
      url: `${baseUrl}/memories`,
      error: e,
    });
    // Swallow errors to avoid breaking the app when memory is unreachable
  }
};

export const fetchRelevantMemories = async (query: string): Promise<MemoryEntry[]> => {
  if (!useCipher || !baseUrl) return [];

  if (!consumeToken()) {
    console.warn('Rate limit exceeded for memory fetching');
    return [];
  }

  try {
    const response = await fetchWithRetry(`${baseUrl}/memories/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      const errorData = await response.text().catch(() => 'Unable to read error response');
      console.error('Failed to fetch memories', {
        url: `${baseUrl}/memories/search`,
        status: response.status,
        statusText: response.statusText,
        body: sanitizeErrorResponse(errorData),
      });
      return [];
    }
    const data = await response.json() as { memories?: MemoryEntry[] };
    return Array.isArray(data.memories) ? data.memories : [];
  } catch (e) {
    console.error('Failed to fetch relevant memories', {
      url: `${baseUrl}/memories/search`,
      error: e,
    });
    return [];
  }
};
