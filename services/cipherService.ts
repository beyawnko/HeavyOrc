import { RunRecord } from '@/types';
import { fetchWithRetry } from '@/services/llmService';
import { sanitizeErrorResponse, validateUrl, readLimitedText, validateCsp } from '@/lib/security';
import { MinHeap } from '@/lib/minHeap';

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
