import {
  SESSION_CACHE_MAX_ENTRIES,
  SESSION_ID_STORAGE_KEY,
  SESSION_SUMMARY_CHAR_THRESHOLD,
  SESSION_ID_SECRET,
} from '@/constants';

export type CachedMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export type Summarizer = (text: string) => Promise<string>;

const cache = new Map<string, CachedMessage[]>();
let ephemeralSessionId: string | null = null;

function signSessionId(id: string): string {
  let hash = 0;
  const input = id + SESSION_ID_SECRET;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

function storeSessionId(id: string): void {
  if (!hasLocalStorage()) return;
  const sig = signSessionId(id);
  window.localStorage.setItem(SESSION_ID_STORAGE_KEY, `${id}.${sig}`);
}

function readSessionId(): string | null {
  if (!hasLocalStorage()) return null;
  const raw = window.localStorage.getItem(SESSION_ID_STORAGE_KEY);
  if (!raw) return null;
  const [id, sig] = raw.split('.');
  if (!id || !sig) return null;
  return signSessionId(id) === sig ? id : null;
}

export const __signSessionId = signSessionId; // for tests

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getSessionId(): string {
  const stored = readSessionId();
  if (stored) return stored;
  if (!hasLocalStorage()) {
    if (!ephemeralSessionId) {
      ephemeralSessionId = crypto.randomUUID();
      console.warn('localStorage unavailable; using ephemeral sessionId');
    }
    return ephemeralSessionId;
  }
  const id = crypto.randomUUID();
  storeSessionId(id);
  return id;
}

export function loadSessionContext(sessionId: string): CachedMessage[] {
  return cache.get(sessionId)?.slice() ?? [];
}

export function appendSessionContext(
  sessionId: string,
  message: CachedMessage,
  maxEntries = SESSION_CACHE_MAX_ENTRIES,
): void {
  const messages = cache.get(sessionId) ?? [];
  messages.push(message);
  if (messages.length > maxEntries) {
    messages.shift();
  }
  cache.set(sessionId, messages);
}

export function __clearSessionCache(): void {
  cache.clear();
  ephemeralSessionId = null;
}

export async function summarizeSessionIfNeeded(
  sessionId: string,
  summarize: Summarizer,
  threshold = SESSION_SUMMARY_CHAR_THRESHOLD,
): Promise<void> {
  const messages = cache.get(sessionId);
  if (!messages || messages.length === 0) return;
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars <= threshold) return;

  const keepStart = Math.floor(messages.length / 2);
  const toSummarize = messages.slice(0, keepStart);
  const keep = messages.slice(keepStart);
  const summaryInput = toSummarize
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
  try {
    const summary = await summarize(summaryInput);
    const summaryMsg: CachedMessage = {
      role: 'assistant',
      content: summary,
      timestamp: Date.now(),
    };
    cache.set(sessionId, [...keep, summaryMsg]);
  } catch (e) {
    console.warn('Failed to summarize session context', e);
    cache.set(sessionId, keep);
  }
}

export function exportSession(sessionId: string): string {
  const messages = cache.get(sessionId) ?? [];
  return JSON.stringify({ sessionId, messages });
}

export function importSession(serialized: string): string | null {
  try {
    const parsed = JSON.parse(serialized) as {
      sessionId: string;
      messages: CachedMessage[];
    };
    if (!parsed.sessionId || !Array.isArray(parsed.messages)) return null;
    const { sessionId, messages } = parsed;
    if (hasLocalStorage()) {
      storeSessionId(sessionId);
    } else {
      ephemeralSessionId = sessionId;
    }
    cache.set(sessionId, messages);
    return sessionId;
  } catch (e) {
    console.warn('Failed to import session', e);
    return null;
  }
}
