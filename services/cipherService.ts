import { RunRecord } from '@/types';
import { fetchWithRetry } from '@/services/llmService';
import { sanitizeErrorResponse } from '@/lib/security';
import { MinHeap } from '@/lib/minHeap';
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
const MAX_CACHE_ENTRIES = 1000;
const MAX_CACHE_SIZE = MAX_RESPONSE_SIZE; // 400KB overall cache limit

let tokens = MAX_REQUESTS;
let lastRefill = Date.now();
const memoryCache = new Map<string, { data: MemoryEntry[]; expiry: number; size: number }>();
let currentCacheSize = 0;
const expiryHeap = new MinHeap<[string, number]>((a, b) => a[1] - b[1]);

function pruneCache() {
  const now = Date.now();
  while (expiryHeap.size() > 0) {
    const [key, exp] = expiryHeap.peek()!;
    const entry = memoryCache.get(key);
    if (!entry || entry.expiry !== exp) {
      expiryHeap.pop();
      continue;
    }
    if (
      exp <= now ||
      memoryCache.size > MAX_CACHE_ENTRIES ||
      currentCacheSize > MAX_CACHE_SIZE
    ) {
      expiryHeap.pop();
      memoryCache.delete(key);
      currentCacheSize -= entry.size;
      continue;
    }
    break;
  }
}

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
    const parsed = new URL(url.normalize('NFKC'));
    let hostname = parsed.hostname;
    if (!ipaddr.isValid(hostname)) {
      try {
        hostname = new URL(`http://${hostname}`).hostname;
      } catch {
        return undefined;
      }
    }
    const bareHost = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      hostname.length > 255 ||
      (!ipaddr.isValid(bareHost) && !/^(?!-)[a-zA-Z0-9-]+(?<!-)(?:\.[a-zA-Z0-9-]+)*$/.test(bareHost)) ||
      (!dev && isPrivateOrLocalhost(hostname))
    ) {
      return undefined;
    }
    parsed.hostname = hostname;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

async function readLimitedText(response: Response, limit: number): Promise<string | undefined> {
  if (!response.body) {
    const text = await response.text();
    return text.length > limit ? undefined : text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let result = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > limit) {
      reader.cancel();
      return undefined;
    }
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
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
  try {
    const response = await fetchWithRetry(
      `${baseUrl}/memories`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run }),
      },
      2,
    );
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
  } catch (e) {
    console.error('Failed to store run record', {
      url: `${baseUrl}/memories`,
      error: e,
    });
    throw e;
  }
};

export const fetchRelevantMemories = async (query: string): Promise<MemoryEntry[]> => {
  if (!useCipher || !baseUrl || !validateUrl(baseUrl)) return [];
  pruneCache();
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
    });

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

    const text = await readLimitedText(response, MAX_RESPONSE_SIZE);
    if (text === undefined) {
      console.error('Memory response too large', {
        url: `${baseUrl}/memories/search`,
      });
      return [];
    }
    const data = JSON.parse(text) as { memories?: MemoryEntry[] };
    const memories = Array.isArray(data.memories)
      ? data.memories.filter(m => m.content.length <= MAX_MEMORY_LENGTH)
      : [];
    const size = memories.reduce((sum, m) => sum + m.content.length, 0);
    const existing = memoryCache.get(query);
    if (existing) {
      currentCacheSize -= existing.size;
    }
    const expiry = Date.now() + CACHE_TTL_MS;
    memoryCache.set(query, { data: memories, expiry, size });
    expiryHeap.push([query, expiry]);
    currentCacheSize += size;
    pruneCache();
    return memories;
  } catch (e) {
    console.error('Failed to fetch relevant memories', {
      url: `${baseUrl}/memories/search`,
      error: e,
    });
    return [];
  }
};
