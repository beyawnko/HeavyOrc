import {
  SESSION_CACHE_MAX_ENTRIES,
  SESSION_ID_STORAGE_KEY,
  SESSION_SUMMARY_CHAR_THRESHOLD,
  SESSION_ID_SECRET,
  SESSION_MESSAGE_MAX_CHARS,
} from '@/constants';
import { logMemory } from '@/lib/memoryLogger';

export type CachedMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export type Summarizer = (text: string) => Promise<string>;

const cache = new Map<string, CachedMessage[]>();
let ephemeralSessionId: string | null = null;

async function signSessionId(id: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(id + SESSION_ID_SECRET);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    if (!id || !sig) return null;
    const expected = await signSessionId(id);
    return expected === sig ? id : null;
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
  const stored = await readSessionId();
  if (stored) return stored;
  if (!hasLocalStorage()) {
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
}

export function loadSessionContext(sessionId: string): CachedMessage[] {
  return cache.get(sessionId)?.slice() ?? [];
}

export function appendSessionContext(
  sessionId: string,
  message: CachedMessage,
  maxEntries = SESSION_CACHE_MAX_ENTRIES,
): void {
  if (message.content.length > SESSION_MESSAGE_MAX_CHARS) {
    message = {
      ...message,
      content: message.content.slice(0, SESSION_MESSAGE_MAX_CHARS),
    };
  }
  const messages = cache.get(sessionId) ?? [];
  messages.push(message);
  if (messages.length > maxEntries) {
    messages.shift();
  }
  cache.set(sessionId, messages);
  logMemory('session.append', { sessionId, size: messages.length });
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
  const messages = cache.get(sessionId) ?? [];
  const serialized = JSON.stringify({ sessionId, messages });
  logMemory('session.export', { sessionId, messages: messages.length });
  return serialized;
}

export async function importSession(serialized: string): Promise<string | null> {
  try {
    const parsed = JSON.parse(serialized) as {
      sessionId: string;
      messages: CachedMessage[];
    };
    if (!parsed.sessionId || !Array.isArray(parsed.messages)) return null;
    const { sessionId, messages } = parsed;
    if (hasLocalStorage()) {
      await storeSessionId(sessionId);
    } else {
      ephemeralSessionId = sessionId;
    }
    cache.set(sessionId, messages);
    logMemory('session.import', { sessionId, messages: messages.length });
    return sessionId;
  } catch (e) {
    console.warn('Failed to import session', e);
    logMemory('session.import.error', { error: e });
    return null;
  }
}
