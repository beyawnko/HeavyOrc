import {
  SESSION_CACHE_MAX_ENTRIES,
  SESSION_ID_STORAGE_KEY,
  SESSION_SUMMARY_CHAR_THRESHOLD,
} from '@/constants';

export type CachedMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export type Summarizer = (text: string) => Promise<string>;

const cache = new Map<string, CachedMessage[]>();
let ephemeralSessionId: string | null = null;

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getSessionId(): string {
  if (hasLocalStorage()) {
    let id = window.localStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(SESSION_ID_STORAGE_KEY, id);
    }
    return id;
  }

  if (!ephemeralSessionId) {
    ephemeralSessionId = crypto.randomUUID();
    console.warn('localStorage unavailable; using ephemeral sessionId');
  }
  return ephemeralSessionId;
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
