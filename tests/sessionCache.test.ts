import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  appendSessionContext,
  loadSessionContext,
  getSessionId,
  __clearSessionCache,
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
    expect(store[SESSION_ID_STORAGE_KEY]).toBe(id1);
  });
});
