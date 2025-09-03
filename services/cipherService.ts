import { RunRecord } from '@/types';
import { fetchWithRetry } from '@/services/llmService';
import { sanitizeErrorResponse, validateUrl, readLimitedText, validateCsp } from '@/lib/security';
import { MinHeap } from '@/lib/minHeap';
import { logMemory } from '@/lib/memoryLogger';

export type ImmutableMemoryEntry = Readonly<{
  id: string;
  content: string;
}>;

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

type CachedMemoryData = {
  readonly data: readonly ImmutableMemoryEntry[];
  readonly expiry: number;
  readonly size: number;
};
const memoryCache = new Map<string, CachedMemoryData>();
let currentCacheSize = 0;
const expiryHeap = new MinHeap<[string, number]>((a, b) => a[1] - b[1]);
const inFlightFetches = new Map<string, Promise<ImmutableMemoryEntry[]>>();

class Mutex {
  private mutex = Promise.resolve();
  runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const result = this.mutex.then(() => fn());
    this.mutex = result.catch(() => {});
    return result;
  }
}
const rateLimitMutex = new Mutex();

const CIRCUIT_BREAKER_THRESHOLD = Number(
  import.meta.env.VITE_CIPHER_CIRCUIT_BREAKER_THRESHOLD ?? 5,
);
const CIRCUIT_BREAKER_RESET_MS = Number(
  import.meta.env.VITE_CIPHER_CIRCUIT_BREAKER_RESET_MS ?? 30000,
);

const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  threshold: CIRCUIT_BREAKER_THRESHOLD,
  resetTimeMs: CIRCUIT_BREAKER_RESET_MS,
};

function recordFailure() {
  circuitBreaker.failures += 1;
  circuitBreaker.lastFailure = Date.now();
}

function isCircuitOpen() {
  return circuitBreaker.failures >= circuitBreaker.threshold;
}

function deepFreeze<T extends object>(
  obj: T,
  visited = new Set<object>(),
): Readonly<T> {
  if (!obj || Object.isFrozen(obj) || visited.has(obj)) return obj;
  visited.add(obj);
  if (Object.hasOwn(obj, '__proto__') || Object.hasOwn(obj, 'constructor')) {
    throw new Error('Object contains potentially unsafe properties');
  }
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      deepFreeze(value, visited);
    }
  }
  return obj;
}

function freezeCacheEntry<T extends object>(data: T): Readonly<T> {
  const clone = structuredClone(data);
  try {
    return deepFreeze(clone);
  } catch (error) {
    console.warn('Failed to freeze cache entry; it will not be cached:', error);
    throw error;
  }
}

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
  clientIpPromise = (async () => {
    if ((globalThis as any).__TEST_IP__) return (globalThis as any).__TEST_IP__;
    if (typeof fetch === 'undefined' || !baseUrl) return null;
    try {
      const res = await fetch(`${baseUrl}/api/client-info`);
      const data = await res.json();
      return data.clientIp as string;
    } catch {
      return null;
    }
  })();
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
  return rateLimitMutex.runExclusive(() => Promise.resolve(exec()));
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
): Promise<ImmutableMemoryEntry[]> => {
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
    return [...cached.data];
  }
  if (query.length > MAX_MEMORY_LENGTH) return [];
  if (isCircuitOpen()) {
    const elapsed = Date.now() - circuitBreaker.lastFailure;
    if (elapsed > circuitBreaker.resetTimeMs) {
      circuitBreaker.failures = 0;
    } else {
      const resetInMs = circuitBreaker.resetTimeMs - elapsed;
      console.warn('Circuit breaker open, skipping memory fetch', {
        failures: circuitBreaker.failures,
        resetInMs,
      });
      logMemory('cipher.fetch.circuitOpen', {
        sessionId,
        query,
        failures: circuitBreaker.failures,
        resetInMs,
      });
      return [];
    }
  }

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
        recordFailure();
        return [];
      }

      const text = await readLimitedText(response, MAX_RESPONSE_SIZE);
      if (text === undefined) {
        console.error('Memory response too large', {
          url: `${baseUrl}/memories/search`,
        });
        recordFailure();
        return [];
      }
      const data = JSON.parse(text) as { memories?: ImmutableMemoryEntry[] };
      const memories = Array.isArray(data.memories)
        ? data.memories.filter(m => m.content.length <= MAX_MEMORY_LENGTH)
        : [];
      const size = memories.reduce((sum, m) => sum + m.content.length, 0);
      const existing = memoryCache.get(cacheKey);
      const expiry = Date.now() + CACHE_TTL_MS;
      try {
        const frozen = freezeCacheEntry(memories);
        if (existing) {
          currentCacheSize -= existing.size;
        }
        memoryCache.set(cacheKey, {
          // Deep freeze entries so cached data can't be mutated
          data: frozen,
          expiry,
          size,
        });
        expiryHeap.push([cacheKey, expiry]);
        currentCacheSize += size;
        pruneCache();
      } catch {
        // Entry wasn't cached because it couldn't be frozen
      }
      logMemory('cipher.fetch', { sessionId, query, count: memories.length });
      circuitBreaker.failures = 0;
      return memories;
    } catch (error) {
      console.error('Failed to fetch relevant memories', {
        url: `${baseUrl}/memories/search`,
        error,
        errorType: error instanceof Error ? error.name : typeof error,
      });
      recordFailure();
      logMemory('cipher.fetch.error', {
        sessionId,
        errorType: error instanceof Error ? error.name : typeof error,
        recoverable:
          error instanceof Error && /temporarily unavailable/i.test(error.message),
        queryLength: query?.length,
      });
      if (error instanceof TypeError) {
        console.warn('Network error while fetching memories - check connectivity');
      }
      return [];
    }
  })();

  inFlightFetches.set(cacheKey, fetchPromise.finally(() => inFlightFetches.delete(cacheKey)));
  return fetchPromise;
};
