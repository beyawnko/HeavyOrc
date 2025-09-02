import { SESSION_CACHE_MAX_ENTRIES, SESSION_ID_STORAGE_KEY } from '@/constants';

export type CachedMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

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
