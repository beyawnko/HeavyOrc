import { RunRecord } from '@/types';
import { fetchWithRetry } from '@/services/llmService';
import { sanitizeErrorResponse } from '@/lib/security';
import * as ipaddr from 'ipaddr.js';

export interface MemoryEntry {
  id: string;
  content: string;
}

const useCipher = import.meta.env.VITE_USE_CIPHER_MEMORY === 'true';
const baseUrl = validateUrl(import.meta.env.VITE_CIPHER_SERVER_URL, import.meta.env.DEV);

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute
const MAX_MEMORY_LENGTH = 4000; // 4KB safety limit per entry
let tokens = MAX_REQUESTS;
let lastRefill = Date.now();

async function consumeToken(): Promise<boolean> {
  const exec = () => {
    const now = Date.now();
    const elapsed = now - lastRefill;
    if (elapsed > 0) {
      tokens = Math.min(MAX_REQUESTS, tokens + (elapsed / RATE_LIMIT_WINDOW) * MAX_REQUESTS);
      lastRefill = now;
    }
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
    return navigator.locks.request('cipher-rate', exec);
  }
  return exec();
}

export function validateUrl(url: string | undefined, dev: boolean = import.meta.env.DEV): string | undefined {
  if (!url || url.length > 2048 || !/^https?:\/\//i.test(url)) return undefined;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) && (dev || !isPrivateOrLocalhost(parsed.hostname)) ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Detects private network or localhost hostnames using ipaddr.js.
 */
function isPrivateOrLocalhost(hostname: string): boolean {
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (host === 'localhost') return true;
  if (ipaddr.isValid(host)) {
    let parsed = ipaddr.parse(host);
    if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    const range = parsed.range();
    return ['loopback', 'linkLocal', 'uniqueLocal', 'private', 'unspecified'].includes(range);
  }
  return false;
}

export const storeRunRecord = async (run: RunRecord): Promise<void> => {
  if (!useCipher || !baseUrl) return;
  if (
    run.prompt.length > MAX_MEMORY_LENGTH ||
    run.finalAnswer.length > MAX_MEMORY_LENGTH ||
    run.agents.some(a => a.content.length > MAX_MEMORY_LENGTH)
  ) {
    console.warn('Run record exceeds memory size limit and will not be stored.');
    return;
  }
  try {
    const response = await fetchWithRetry(`${baseUrl}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run }),
    });
    const csp = response.headers.get('Content-Security-Policy');
    if (csp) {
      type CSPDirective = { name: string; sources: string[] };

      const parseDirective = (directive: string): CSPDirective => {
        const [name, ...sources] = directive.trim().split(/\s+/);
        return { name, sources };
      };

      const directives = csp
        .split(';')
        .map(d => d.trim())
        .filter(Boolean)
        .map(parseDirective)
        .filter(d => d.name && d.sources.length > 0);

      const allowsSelf = directives.some(
        d =>
          (d.name === 'connect-src' || d.name === 'default-src') &&
          d.sources.includes("'self'")
      );

      if (!allowsSelf) {
        console.error('Invalid or insufficient CSP headers from memory server');
        throw new Error('Invalid CSP headers');
      }
    } else {
      console.error('Missing CSP headers from memory server');
      throw new Error('Missing CSP headers');
    }
    if (!response.ok) {
      const errorData = await response.text().catch(() => 'Unable to read error response');
      console.error('Failed to store run record', {
        url: `${baseUrl}/memories`,
        status: response.status,
        statusText: response.statusText,
        body: sanitizeErrorResponse(errorData),
      });
      throw new Error('Failed to store run record with status ' + response.status);
    }
  } catch (e) {
    console.error('Failed to store run record', {
      url: `${baseUrl}/memories`,
      error: e,
    });
    throw e;
  }
};

export const fetchRelevantMemories = async (query: string): Promise<MemoryEntry[]> => {
  if (!useCipher || !baseUrl) return [];
  if (query.length > MAX_MEMORY_LENGTH) return [];

  if (!(await consumeToken())) {
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
    return Array.isArray(data.memories)
      ? data.memories.filter(m => m.content.length <= MAX_MEMORY_LENGTH)
      : [];
  } catch (e) {
    console.error('Failed to fetch relevant memories', {
      url: `${baseUrl}/memories/search`,
      error: e,
    });
    return [];
  }
};
