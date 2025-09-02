import { RunRecord } from '@/types';
import { fetchWithRetry } from '@/services/llmService';
import { sanitizeErrorResponse, validateUrl, readLimitedText, validateCsp } from '@/lib/security';
import { MinHeap } from '@/lib/minHeap';
import { logMemory } from '@/lib/memoryLogger';

export interface MemoryEntry {
  id: string;
  content: string;
}

const useCipher = import.meta.env.VITE_USE_CIPHER_MEMORY === 'true';
const baseUrl = validateUrl(import.meta.env.VITE_CIPHER_SERVER_URL, [], import.meta.env.DEV);
const allowedHosts = baseUrl ? [new URL(baseUrl).hostname] : [];
const enforceCsp = import.meta.env.VITE_ENFORCE_CIPHER_CSP === 'true';

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute per session
const MAX_MEMORY_LENGTH = 4000; // 4KB safety limit per entry
const MAX_RESPONSE_SIZE = MAX_MEMORY_LENGTH * 100; // 400KB total response cap
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 1000;
const MAX_CACHE_SIZE = MAX_RESPONSE_SIZE; // 400KB overall cache limit

const sessionBuckets = new Map<string, { tokens: number; lastRefill: number }>();
const ipBuckets = new Map<string, { tokens: number; lastRefill: number }>();
let clientIpPromise: Promise<string | null> | null = null;
const memoryCache = new Map<string, { data: MemoryEntry[]; expiry: number; size: number }>();
let currentCacheSize = 0;
const expiryHeap = new MinHeap<[string, number]>((a, b) => a[1] - b[1]);
const inFlightFetches = new Map<string, Promise<MemoryEntry[]>>();

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

function consumeFromBucket(
  buckets: Map<string, { tokens: number; lastRefill: number }>,
  key: string,
): boolean {
  const bucket = buckets.get(key) || { tokens: MAX_REQUESTS, lastRefill: Date.now() };
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    bucket.tokens = Math.min(
      MAX_REQUESTS,
      bucket.tokens + (elapsed / RATE_LIMIT_WINDOW) * MAX_REQUESTS,
    );
    bucket.lastRefill = now;
  }
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}

async function getClientIp(): Promise<string | null> {
  if (clientIpPromise) return clientIpPromise;
  if ((globalThis as any).__TEST_IP__) {
    clientIpPromise = Promise.resolve((globalThis as any).__TEST_IP__);
    return clientIpPromise;
  }
  if (typeof fetch === 'undefined') return null;
  clientIpPromise = fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then(d => d.ip as string)
    .catch(() => null);
  const ip = await clientIpPromise;
  clientIpPromise = Promise.resolve(ip);
  return ip;
}

async function consumeToken(sessionId: string): Promise<boolean> {
  // TODO: replace with a distributed rate limiter (e.g., Redis) for multi-instance deployments
  const ip = await getClientIp();
  const exec = () => {
    const okSession = consumeFromBucket(sessionBuckets, sessionId);
    const okIp = ip ? consumeFromBucket(ipBuckets, ip) : true;
    return okSession && okIp;
  };
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
    return navigator.locks.request(`cipher-rate:${sessionId}`, exec);
  }
  return exec();
}

export const storeRunRecords = async (
  runs: RunRecord[],
  sessionId: string,
): Promise<void> => {
  if (!useCipher || !baseUrl || !validateUrl(baseUrl, allowedHosts)) return;
  if (!(await consumeToken(sessionId))) {
    console.warn('Rate limit exceeded for memory storage');
    logMemory('cipher.store.rateLimit', { sessionId });
    return;
  }
  for (const run of runs) {
    if (
      run.prompt.length > MAX_MEMORY_LENGTH ||
      run.finalAnswer.length > MAX_MEMORY_LENGTH ||
      run.agents.some(a => a.content.length > MAX_MEMORY_LENGTH)
    ) {
      console.warn('Run record exceeds memory size limit and will not be stored.');
      logMemory('cipher.store.tooLarge', { sessionId });
      return;
    }
  }
  try {
    const response = await fetchWithRetry(
      `${baseUrl}/memories/batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runs, sessionId }),
      },
      2,
    );
    if (enforceCsp) validateCsp(response);
    if (!response.ok) {
      const errorData = await response.text().catch(() => 'Unable to read error response');
      console.error('Failed to store run records', {
        url: `${baseUrl}/memories/batch`,
        status: response.status,
        statusText: response.statusText,
        body: sanitizeErrorResponse(errorData),
      });
      throw new Error('Failed to store run records with status ' + response.status);
    }
    logMemory('cipher.store', {
      sessionId,
      promptLength: runs.reduce((s, r) => s + r.prompt.length, 0),
      finalLength: runs.reduce((s, r) => s + r.finalAnswer.length, 0),
      agentCount: runs.reduce((s, r) => s + r.agents.length, 0),
      batch: runs.length,
    });
  } catch (e) {
    console.error('Failed to store run records', {
      url: `${baseUrl}/memories/batch`,
      error: e,
    });
    logMemory('cipher.store.error', { sessionId, error: e });
    throw e;
  }
};

export const storeRunRecord = async (
  run: RunRecord,
  sessionId: string,
): Promise<void> => storeRunRecords([run], sessionId);

export const fetchRelevantMemories = async (
  query: string,
  sessionId: string,
): Promise<MemoryEntry[]> => {
  if (!useCipher || !baseUrl || !validateUrl(baseUrl, allowedHosts)) return [];
  pruneCache();
  const cacheKey = `${sessionId}:${query}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    logMemory('cipher.fetch.cacheHit', {
      sessionId,
      query,
      count: cached.data.length,
    });
    return cached.data;
  }
  if (query.length > MAX_MEMORY_LENGTH) return [];
  if (inFlightFetches.has(cacheKey)) {
    return inFlightFetches.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    if (!(await consumeToken(sessionId))) {
      console.warn('Rate limit exceeded for memory fetching');
      logMemory('cipher.fetch.rateLimit', { sessionId, query });
      return [];
    }

    try {
      const response = await fetchWithRetry(`${baseUrl}/memories/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, sessionId }),
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
      const existing = memoryCache.get(cacheKey);
      if (existing) {
        currentCacheSize -= existing.size;
      }
      const expiry = Date.now() + CACHE_TTL_MS;
      memoryCache.set(cacheKey, { data: memories, expiry, size });
      expiryHeap.push([cacheKey, expiry]);
      currentCacheSize += size;
      pruneCache();
      logMemory('cipher.fetch', { sessionId, query, count: memories.length });
      return memories;
    } catch (e) {
      console.error('Failed to fetch relevant memories', {
        url: `${baseUrl}/memories/search`,
        error: e,
      });
      logMemory('cipher.fetch.error', { sessionId, query, error: e });
      return [];
    }
  })();

  inFlightFetches.set(cacheKey, fetchPromise.finally(() => inFlightFetches.delete(cacheKey)));
  return fetchPromise;
};
