import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  appendSessionContext,
  loadSessionContext,
  getSessionId,
  __clearSessionCache,
  summarizeSessionIfNeeded,
  exportSession,
  importSession,
  __signSessionId,
} from '@/lib/sessionCache';
import { SESSION_CACHE_MAX_ENTRIES, SESSION_ID_STORAGE_KEY } from '@/constants';

describe('sessionCache', () => {
  beforeEach(() => {
    __clearSessionCache();
    // reset environment
    delete (globalThis as any).window;
  });

  it('appends messages and enforces LRU size', () => {
    const sessionId = 'test';
    for (let i = 0; i < SESSION_CACHE_MAX_ENTRIES + 5; i++) {
      appendSessionContext(sessionId, {
        role: 'user',
        content: `m${i}`,
        timestamp: i,
      });
    }
    const ctx = loadSessionContext(sessionId);
    expect(ctx).toHaveLength(SESSION_CACHE_MAX_ENTRIES);
    expect(ctx[0].content).toBe('m5');
    expect(ctx[ctx.length - 1].content).toBe(`m${SESSION_CACHE_MAX_ENTRIES + 4}`);
  });

  it('generates stable sessionId with ephemeral fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const id1 = getSessionId();
    const id2 = getSessionId();
    expect(id1).toBe(id2);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('persists sessionId to localStorage when available', () => {
    const store: Record<string, string> = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
    };
    const id1 = getSessionId();
    const id2 = getSessionId();
    expect(id1).toBe(id2);
    expect(store[SESSION_ID_STORAGE_KEY]).toBe(
      `${id1}.${__signSessionId(id1)}`,
    );
  });

  it('summarizes overflowing context', async () => {
    const sessionId = 's';
    const long = 'x'.repeat(SESSION_CACHE_MAX_ENTRIES * 300);
    appendSessionContext(sessionId, { role: 'user', content: long, timestamp: 0 });
    appendSessionContext(sessionId, { role: 'assistant', content: long, timestamp: 1 });
    const summarizer = vi.fn(async () => 'summary');
    await summarizeSessionIfNeeded(sessionId, summarizer, 1000);
    expect(summarizer).toHaveBeenCalledOnce();
    const ctx = loadSessionContext(sessionId);
    expect(ctx).toHaveLength(2);
    expect(ctx[1].content).toBe('summary');
  });

  it('emits structured log on summarization', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const sessionId = 'log';
    const long = 'y'.repeat(2000);
    appendSessionContext(sessionId, { role: 'user', content: long, timestamp: 0 });
    appendSessionContext(sessionId, { role: 'assistant', content: long, timestamp: 1 });
    const summarizer = vi.fn(async () => 'summary');
    await summarizeSessionIfNeeded(sessionId, summarizer, 1000);
    const hasEvent = debug.mock.calls.some(([arg]) =>
      typeof arg === 'object' &&
      (arg as any).event === 'session.summarize' &&
      (arg as any).sessionId === sessionId,
    );
    expect(hasEvent).toBe(true);
    debug.mockRestore();
  });

  it('exports and imports session data', () => {
    const sessionId = 'exp';
    appendSessionContext(sessionId, {
      role: 'user',
      content: 'hello',
      timestamp: 1,
    });
    const serialized = exportSession(sessionId);
    __clearSessionCache();
    const store: Record<string, string> = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
    };
    const importedId = importSession(serialized);
    expect(importedId).toBe(sessionId);
    expect(store[SESSION_ID_STORAGE_KEY]).toBe(
      `${sessionId}.${__signSessionId(sessionId)}`,
    );
    const ctx = loadSessionContext(sessionId);
    expect(ctx).toHaveLength(1);
    expect(ctx[0].content).toBe('hello');
  });

  it('returns null on malformed import', () => {
    const res = importSession('not-json');
    expect(res).toBeNull();
  });

  it('regenerates sessionId if signature mismatch', () => {
    const store: Record<string, string> = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
    };
    const id1 = getSessionId();
    store[SESSION_ID_STORAGE_KEY] = `${id1}.bogus`;
    const id2 = getSessionId();
    expect(id2).not.toBe(id1);
    expect(store[SESSION_ID_STORAGE_KEY]).toBe(
      `${id2}.${__signSessionId(id2)}`,
    );
  });
});
