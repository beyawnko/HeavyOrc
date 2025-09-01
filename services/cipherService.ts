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
const enforceCsp = import.meta.env.VITE_ENFORCE_CIPHER_CSP === 'true';

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute
const MAX_MEMORY_LENGTH = 4000; // 4KB safety limit per entry
const MAX_RESPONSE_SIZE = MAX_MEMORY_LENGTH * 100; // 400KB total response cap
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let tokens = MAX_REQUESTS;
let lastRefill = Date.now();
const memoryCache = new Map<string, { data: MemoryEntry[]; expiry: number }>();

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
    const hostname = parsed.hostname;
    const bareHost = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      hostname.length > 255 ||
      (!ipaddr.isValid(bareHost) && !/^[a-zA-Z0-9.-]+$/.test(bareHost)) ||
      (!dev && isPrivateOrLocalhost(hostname))
    ) {
      return undefined;
    }
    return url;
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

function validateCsp(response: Response): void {
  const csp = response.headers.get('Content-Security-Policy');
  if (!csp) {
    console.error('Missing CSP headers from memory server');
    throw new Error('Missing CSP headers');
  }

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
  const defaultSrc = directives.find(d => d.name === 'default-src');
  const connectSrc = directives.find(d => d.name === 'connect-src');
  const objectSrc = directives.find(d => d.name === 'object-src');
  const baseUri = directives.find(d => d.name === 'base-uri');

  const hasUnsafeSource = directives.some(d =>
    d.sources.some(s =>
      s === "'unsafe-inline'" ||
      s === "'unsafe-eval'" ||
      s === '*'
    )
  );
  const isDefaultSrcStrict =
    !!defaultSrc &&
    defaultSrc.sources.length === 1 &&
    defaultSrc.sources[0] === "'none'";
  const isConnectSrcSelf =
    !!connectSrc &&
    connectSrc.sources.length === 1 &&
    connectSrc.sources[0] === "'self'";
  const isObjectSrcSafe =
    !objectSrc ||
    (objectSrc.sources.length === 1 && objectSrc.sources[0] === "'none'");
  const isBaseUriSafe =
    !baseUri || (baseUri.sources.length === 1 && baseUri.sources[0] === "'none'");

  if (
    !isDefaultSrcStrict ||
    !isConnectSrcSelf ||
    hasUnsafeSource ||
    !isObjectSrcSafe ||
    !isBaseUriSafe
  ) {
    console.error('Invalid or insufficient CSP headers from memory server');
    throw new Error('Invalid CSP headers');
  }
}

export const storeRunRecord = async (run: RunRecord): Promise<void> => {
  if (!useCipher || !baseUrl || !validateUrl(baseUrl)) return;
  if (!(await consumeToken())) {
    console.warn('Rate limit exceeded for memory storage');
    return;
  }
  if (
    run.prompt.length > MAX_MEMORY_LENGTH ||
    run.finalAnswer.length > MAX_MEMORY_LENGTH ||
    run.agents.some(a => a.content.length > MAX_MEMORY_LENGTH)
  ) {
    console.warn('Run record exceeds memory size limit and will not be stored.');
    return;
  }
  const backoff = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 10000);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchWithRetry(`${baseUrl}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run }),
      }, 0);
      if (enforceCsp) validateCsp(response);
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
      return;
    } catch (e) {
      if (attempt === 2) {
        console.error('Failed to store run record', {
          url: `${baseUrl}/memories`,
          error: e,
        });
        throw e;
      }
      await new Promise(resolve => setTimeout(resolve, backoff(attempt)));
    }
  }
};

export const fetchRelevantMemories = async (query: string): Promise<MemoryEntry[]> => {
  if (!useCipher || !baseUrl || !validateUrl(baseUrl)) return [];
  const cached = memoryCache.get(query);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
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
    }, 0);

    if (enforceCsp) validateCsp(response);
    if (!response.ok) {
      const errorData = await response
        .text()
        .catch(() => 'Unable to read error response');
      console.error('Failed to fetch memories', {
        url: `${baseUrl}/memories/search`,
        status: response.status,
        statusText: response.statusText,
        body: sanitizeErrorResponse(errorData),
      });
      return [];
    }

    const text = await response.text();
    if (text.length > MAX_RESPONSE_SIZE) {
      console.error('Memory response too large', {
        url: `${baseUrl}/memories/search`,
      });
      return [];
    }
    const data = JSON.parse(text) as { memories?: MemoryEntry[] };
    const memories = Array.isArray(data.memories)
      ? data.memories.filter(m => m.content.length <= MAX_MEMORY_LENGTH)
      : [];
    memoryCache.set(query, { data: memories, expiry: Date.now() + CACHE_TTL_MS });
    return memories;
  } catch (e) {
    console.error('Failed to fetch relevant memories', {
      url: `${baseUrl}/memories/search`,
      error: e,
    });
    return [];
  }
};
