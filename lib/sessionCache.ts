import {
  SESSION_CACHE_MAX_ENTRIES,
  SESSION_ID_STORAGE_KEY,
  SESSION_SUMMARY_CHAR_THRESHOLD,
  SESSION_ID_SECRET,
  SESSION_MESSAGE_MAX_CHARS,
  SESSION_SUMMARY_KEEP_RATIO,
  SESSION_SUMMARY_DEBOUNCE_MS,
  SESSION_IMPORTS_PER_MINUTE,
  SESSION_CONTEXT_TTL_MS,
  MEMORY_PRESSURE_THRESHOLD,
  SESSION_CACHE_MAX_SESSIONS,
  SESSION_ID_PATTERN,
} from '@/constants';
import { logMemory } from '@/lib/memoryLogger';
import { escapeHtml } from '@/lib/utils';
import { SessionImportError } from '@/lib/errors';
import { LRUCache } from '@/lib/lruCache';

export type CachedMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  hash?: string;
};

export type Summarizer = (text: string) => Promise<string>;

const cache = new LRUCache<string, CachedMessage[]>(SESSION_CACHE_MAX_SESSIONS);
export const __cache = cache; // for tests
let dynamicMaxEntries = SESSION_CACHE_MAX_ENTRIES;
let ephemeralSessionId: string | null = null;
let sessionIdPromise: Promise<string> | null = null;
const lastSummaryTime = new Map<string, number>();
const importTimestamps: number[] = [];

function integrityHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function detectCacheLeak(): void {
  if (cache.size >= SESSION_CACHE_MAX_SESSIONS) {
    console.warn('session cache at capacity');
    logMemory('session.cache.leak', { size: cache.size });
  }

  // Monitor browser memory pressure
  const memoryInfo = (performance as any).memory;
  if (memoryInfo && memoryInfo.usedJSHeapSize > memoryInfo.jsHeapSizeLimit * 0.9) {
    console.warn('High memory pressure detected');
    logMemory('session.cache.memory_pressure', {
      used: memoryInfo.usedJSHeapSize,
      limit: memoryInfo.jsHeapSizeLimit,
    });
    cache.clear();
  }
}

type StorageEstimateResult = { usage?: number; quota?: number };

function checkStorageQuota(): Promise<number> {
  if (typeof navigator === 'undefined' || !(navigator as any).storage?.estimate) {
    return Promise.resolve(0);
  }
  return (navigator as any).storage
    .estimate()
    .then(({ usage, quota }: StorageEstimateResult) => (usage && quota ? usage / quota : 0))
    .catch(() => 0);
}

async function adjustCacheSize(): Promise<void> {
  const pressure = await checkStorageQuota();
  if (pressure > MEMORY_PRESSURE_THRESHOLD) {
    const newSize = Math.max(1, Math.floor(dynamicMaxEntries * 0.75));
    if (newSize < dynamicMaxEntries) {
      dynamicMaxEntries = newSize;
      for (const [id, msgs] of cache) {
        if (msgs.length > dynamicMaxEntries) {
          cache.set(id, msgs.slice(-dynamicMaxEntries));
        }
      }
      logMemory('session.cache.shrink', { maxEntries: dynamicMaxEntries, pressure });
    }
  }
}

export const __adjustCacheSize = adjustCacheSize; // for tests
export const __getMaxEntries = () => dynamicMaxEntries; // for tests

function pruneSession(sessionId: string): void {
  const messages = cache.get(sessionId);
  if (!messages) return;
  const cutoff = Date.now() - SESSION_CONTEXT_TTL_MS;
  const filtered = messages.filter(m => m.timestamp >= cutoff);
  if (filtered.length === 0) {
    cache.delete(sessionId);
    lastSummaryTime.delete(sessionId);
  } else if (filtered.length !== messages.length) {
    cache.set(sessionId, filtered);
  }
}

async function signSessionId(id: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SESSION_ID_SECRET);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(id));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function isValidSessionId(id: string): boolean {
  return SESSION_ID_PATTERN.test(id) && new Set(id).size >= 10;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function storeSessionId(id: string): Promise<boolean> {
  if (!hasLocalStorage()) return false;
  try {
    const sig = await signSessionId(id);
    window.localStorage.setItem(SESSION_ID_STORAGE_KEY, `${id}.${sig}`);
    return true;
  } catch (e) {
    console.warn('Failed to persist sessionId', e);
    return false;
  }
}

async function readSessionId(): Promise<string | null> {
  if (!hasLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (!raw) return null;
    const [id, sig] = raw.split('.');
    if (!id || !sig || !isValidSessionId(id)) return null;
    const expected = await signSessionId(id);
    return timingSafeEqual(expected, sig) ? id : null;
  } catch (e) {
    console.warn('Failed to read sessionId', e);
    return null;
  }
}

export const __signSessionId = signSessionId; // for tests

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export async function getSessionId(): Promise<string> {
  if (sessionIdPromise) return sessionIdPromise;
  sessionIdPromise = (async () => {
    const stored = await readSessionId();
    if (stored) return stored;
    if (!hasLocalStorage() || ephemeralSessionId) {
      if (!ephemeralSessionId) {
        ephemeralSessionId = crypto.randomUUID();
        console.warn('localStorage unavailable; using ephemeral sessionId');
      }
      return ephemeralSessionId;
    }
    const id = crypto.randomUUID();
    const persisted = await storeSessionId(id);
    if (!persisted) {
      if (!ephemeralSessionId) {
        ephemeralSessionId = id;
        console.warn('localStorage unavailable; using ephemeral sessionId');
      }
      return ephemeralSessionId;
    }
    return id;
  })();
  try {
    return await sessionIdPromise;
  } finally {
    sessionIdPromise = null;
  }
}

export function loadSessionContext(sessionId: string): CachedMessage[] {
  pruneSession(sessionId);
  const messages = cache.get(sessionId) ?? [];
  return messages.filter(m => m.hash === integrityHash(m.content)).slice();
}

export function appendSessionContext(
  sessionId: string,
  message: CachedMessage,
  maxEntries = dynamicMaxEntries,
): void {
  if (!message.content || typeof message.content !== 'string') {
    throw new Error('Invalid message content');
  }
  let sanitized = escapeHtml(message.content);
  if (sanitized.length > SESSION_MESSAGE_MAX_CHARS) {
    sanitized = sanitized.slice(0, SESSION_MESSAGE_MAX_CHARS);
  }
  message = { ...message, content: sanitized, hash: integrityHash(sanitized) };
  const messages = cache.get(sessionId) ?? [];
  messages.push(message);
  if (messages.length > maxEntries) {
    messages.shift();
  }
  cache.set(sessionId, messages);
  pruneSession(sessionId);
  const final = cache.get(sessionId) ?? [];
  logMemory('session.append', { sessionId, size: final.length });
  void adjustCacheSize();
  detectCacheLeak();
}

export function __clearSessionCache(): void {
  cache.clear();
  ephemeralSessionId = null;
  sessionIdPromise = null;
  lastSummaryTime.clear();
  importTimestamps.length = 0;
  dynamicMaxEntries = SESSION_CACHE_MAX_ENTRIES;
}

export async function summarizeSessionIfNeeded(
  sessionId: string,
  summarize: Summarizer,
  threshold = SESSION_SUMMARY_CHAR_THRESHOLD,
  keepRatio = SESSION_SUMMARY_KEEP_RATIO,
): Promise<void> {
  const now = Date.now();
  const last = lastSummaryTime.get(sessionId) ?? 0;
  if (now - last < SESSION_SUMMARY_DEBOUNCE_MS) return;
  lastSummaryTime.set(sessionId, now);
  pruneSession(sessionId);
  const messages = cache.get(sessionId);
  if (!messages || messages.length === 0) return;
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars <= threshold) return;

  const ratio = Math.min(Math.max(keepRatio, 0), 1);
  const keepStart = Math.floor(messages.length * ratio);
  const toSummarize = messages.slice(0, keepStart);
  const keep = messages.slice(keepStart);
  const summaryInput = toSummarize
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  try {
    let summary = escapeHtml(await summarize(summaryInput));
    if (summary.length > SESSION_MESSAGE_MAX_CHARS) {
      summary = summary.slice(0, SESSION_MESSAGE_MAX_CHARS);
    }
    const summaryMsg: CachedMessage = {
      role: 'assistant',
      content: summary,
      timestamp: Date.now(),
      hash: integrityHash(summary),
    };
    cache.set(sessionId, [...keep, summaryMsg]);
    logMemory('session.summarize', {
      sessionId,
      removed: toSummarize.length,
      summaryLength: summary.length,
      finalSize: keep.length + 1,
    });
  } catch (e) {
    console.warn('Failed to summarize session context', e);
    logMemory('session.summarize.error', { sessionId, error: e });
    cache.set(sessionId, keep);
  }
}

export function exportSession(sessionId: string): string {
  pruneSession(sessionId);
  const messages = cache.get(sessionId) ?? [];
  const serialized = JSON.stringify({ sessionId, messages });
  logMemory('session.export', { sessionId, messages: messages.length });
  return serialized;
}

export async function importSession(serialized: string): Promise<string | null> {
  const now = Date.now();
  while (importTimestamps.length && now - importTimestamps[0] > 60_000) {
    importTimestamps.shift();
  }
  if (importTimestamps.length >= SESSION_IMPORTS_PER_MINUTE) {
    const err = new SessionImportError('Rate limit exceeded');
    console.warn('Failed to import session', err);
    logMemory('session.import.error', { error: err });
    return null;
  }
  importTimestamps.push(now);
  try {
    const parsed = JSON.parse(serialized) as {
      sessionId: string;
      messages: CachedMessage[];
    };
    if (
      typeof parsed.sessionId !== 'string' ||
      !isValidSessionId(parsed.sessionId) ||
      !Array.isArray(parsed.messages)
    ) {
      throw new SessionImportError('Invalid session format');
    }
    const validated = parsed.messages.map(msg => {
      if (typeof msg !== 'object' || !msg) throw new SessionImportError('Invalid message');
      if (!['user', 'assistant'].includes((msg as any).role)) {
        throw new SessionImportError('Invalid message role');
      }
      if (typeof (msg as any).content !== 'string') {
        throw new SessionImportError('Invalid message content');
      }
      if (typeof (msg as any).timestamp !== 'number' || isNaN((msg as any).timestamp)) {
        throw new SessionImportError('Invalid message timestamp');
      }
      let content = escapeHtml((msg as any).content);
      if (content.length > SESSION_MESSAGE_MAX_CHARS) {
        content = content.slice(0, SESSION_MESSAGE_MAX_CHARS);
      }
      return {
        role: (msg as any).role as 'user' | 'assistant',
        content,
        timestamp: (msg as any).timestamp,
        hash: integrityHash(content),
      };
    });
    const cutoff = Date.now() - SESSION_CONTEXT_TTL_MS;
    const filtered = validated.filter(m => m.timestamp >= cutoff);
    const capped = filtered.slice(-dynamicMaxEntries);
    const { sessionId } = parsed;
    if (hasLocalStorage()) {
      const persisted = await storeSessionId(sessionId);
      if (!persisted) {
        ephemeralSessionId = sessionId;
        console.warn('localStorage unavailable; using ephemeral sessionId');
      }
    } else {
      ephemeralSessionId = sessionId;
    }
    cache.set(sessionId, capped);
    logMemory('session.import', { sessionId, messages: capped.length });
    void adjustCacheSize();
    detectCacheLeak();
    return sessionId;
  } catch (e) {
    console.warn('Failed to import session', e);
    logMemory('session.import.error', { error: e });
    return null;
  }
}
