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
  __cache,
  __adjustCacheSize,
  __getMaxEntries,
} from '@/lib/sessionCache';
import {
  SESSION_CACHE_MAX_ENTRIES,
  SESSION_ID_STORAGE_KEY,
  SESSION_MESSAGE_MAX_CHARS,
  SESSION_IMPORTS_PER_MINUTE,
  SESSION_CONTEXT_TTL_MS,
  SESSION_CACHE_MAX_SESSIONS,
  SESSION_ID_VERSION,
} from '@/constants';

function setNavigator(value: any): void {
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true });
}

describe('sessionCache', () => {
  beforeEach(() => {
    __clearSessionCache(true);
    // reset environment
    delete (globalThis as any).window;
    delete (globalThis as any).navigator;
  });

  it('appends messages and enforces LRU size', () => {
    const sessionId = 'test';
    const base = Date.now();
    for (let i = 0; i < SESSION_CACHE_MAX_ENTRIES + 5; i++) {
      appendSessionContext(sessionId, {
        role: 'user',
        content: `m${i}`,
        timestamp: base + i,
      });
    }
    const ctx = loadSessionContext(sessionId);
    expect(ctx).toHaveLength(SESSION_CACHE_MAX_ENTRIES);
    expect(ctx[0].content).toBe('m5');
    expect(ctx[ctx.length - 1].content).toBe(`m${SESSION_CACHE_MAX_ENTRIES + 4}`);
  });

  it('rate limits cache clearing', () => {
    vi.useFakeTimers();
    __clearSessionCache(true);
    const originalPerf = globalThis.performance;
    const perf = { memory: { usedJSHeapSize: 91, jsHeapSizeLimit: 100 } } as any;
    Object.defineProperty(globalThis, 'performance', { value: perf, configurable: true });
    appendSessionContext('s', {
      role: 'user',
      content: 'm',
      timestamp: Date.now(),
    });
    __clearSessionCache();
    appendSessionContext('s', {
      role: 'user',
      content: 'm2',
      timestamp: Date.now(),
    });
    __clearSessionCache();
    const ctx = loadSessionContext('s');
    expect(ctx).toHaveLength(1);
    vi.useRealTimers();
    Object.defineProperty(globalThis, 'performance', {
      value: originalPerf,
      configurable: true,
    });
  });

  it('evicts messages past TTL', () => {
    const sessionId = 'ttl';
    appendSessionContext(sessionId, {
      role: 'user',
      content: 'old',
      timestamp: Date.now() - SESSION_CONTEXT_TTL_MS - 1000,
    });
    const ctx = loadSessionContext(sessionId);
    expect(ctx).toHaveLength(0);
  });

  it('evicts oldest sessions when exceeding max sessions', () => {
    for (let i = 0; i < SESSION_CACHE_MAX_SESSIONS + 5; i++) {
      appendSessionContext(`s${i}`, {
        role: 'user',
        content: 'x',
        timestamp: Date.now(),
      });
    }
    expect(__cache.size).toBe(SESSION_CACHE_MAX_SESSIONS);
    expect(__cache.has('s0')).toBe(false);
  });

  it('enforces per-message size limit', () => {
    const sessionId = 'limit';
    const long = 'a'.repeat(SESSION_MESSAGE_MAX_CHARS + 100);
    appendSessionContext(sessionId, {
      role: 'user',
      content: long,
      timestamp: Date.now(),
    });
    const ctx = loadSessionContext(sessionId);
    expect(ctx[0].content.length).toBe(SESSION_MESSAGE_MAX_CHARS);
  });

  it('generates stable sessionId with ephemeral fallback', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const id1 = await getSessionId();
    const id2 = await getSessionId();
    expect(id1).toBe(id2);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('resolves same sessionId for concurrent calls', async () => {
    const [id1, id2] = await Promise.all([getSessionId(), getSessionId()]);
    expect(id1).toBe(id2);
  });

  it('persists sessionId to localStorage when available', async () => {
    const store: Record<string, string> = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
    };
    const id1 = await getSessionId();
    const id2 = await getSessionId();
    expect(id1).toBe(id2);
    expect(store[SESSION_ID_STORAGE_KEY]).toBe(
      `${SESSION_ID_VERSION}:${id1}.${await __signSessionId(id1)}`,
    );
  });

  it('falls back when localStorage errors', async () => {
    (globalThis as any).window = {
      localStorage: {
        getItem: () => {
          throw new Error('QuotaExceededError');
        },
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const id1 = await getSessionId();
    const id2 = await getSessionId();
    expect(id1).toBe(id2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('summarizes overflowing context', async () => {
    const sessionId = 's';
    const long = 'x'.repeat(SESSION_CACHE_MAX_ENTRIES * 300);
    const base = Date.now();
    appendSessionContext(sessionId, { role: 'user', content: long, timestamp: base });
    appendSessionContext(sessionId, { role: 'assistant', content: long, timestamp: base + 1 });
    const summarizer = vi.fn(async () => 'summary');
    await summarizeSessionIfNeeded(sessionId, summarizer, 1000);
    expect(summarizer).toHaveBeenCalledOnce();
    const ctx = loadSessionContext(sessionId);
    expect(ctx).toHaveLength(2);
    expect(ctx[1].content).toBe('summary');
  });

  it('throttles rapid summarization', async () => {
    const sessionId = 'throttle';
    const long = 'z'.repeat(2000);
    const base = Date.now();
    appendSessionContext(sessionId, { role: 'user', content: long, timestamp: base });
    appendSessionContext(sessionId, { role: 'assistant', content: long, timestamp: base + 1 });
    const summarizer = vi.fn(async () => 'summary');
    await summarizeSessionIfNeeded(sessionId, summarizer, 1000);
    await summarizeSessionIfNeeded(sessionId, summarizer, 1000);
    expect(summarizer).toHaveBeenCalledOnce();
  });

  it('emits structured log on summarization', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const sessionId = 'log';
    const long = 'y'.repeat(2000);
    const base = Date.now();
    appendSessionContext(sessionId, { role: 'user', content: long, timestamp: base });
    appendSessionContext(sessionId, { role: 'assistant', content: long, timestamp: base + 1 });
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

  it('exports and imports session data', async () => {
    const sessionId = '123e4567-e89b-12d3-a456-426614174000';
    appendSessionContext(sessionId, {
      role: 'user',
      content: 'hello',
      timestamp: Date.now(),
    });
    const serialized = exportSession(sessionId);
    __clearSessionCache(true);
    const store: Record<string, string> = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
    };
    const importedId = await importSession(serialized);
    expect(importedId).toBe(sessionId);
    expect(store[SESSION_ID_STORAGE_KEY]).toBe(
      `${SESSION_ID_VERSION}:${sessionId}.${await __signSessionId(sessionId)}`,
    );
    const ctx = loadSessionContext(sessionId);
    expect(ctx).toHaveLength(1);
    expect(ctx[0].content).toBe('hello');
  });

  it('uses imported sessionId when localStorage write fails', async () => {
    const serialized = JSON.stringify({
      sessionId: '123e4567-e89b-12d3-a456-426614174111',
      messages: [],
    });
    (globalThis as any).window = {
      localStorage: {
        getItem: () => {
          throw new Error('QuotaExceededError');
        },
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const id = await importSession(serialized);
    expect(id).toBe('123e4567-e89b-12d3-a456-426614174111');
    const resolved = await getSessionId();
    expect(resolved).toBe('123e4567-e89b-12d3-a456-426614174111');
    warn.mockRestore();
  });

  it('returns null on malformed import', async () => {
    const res = await importSession('not-json');
    expect(res).toBeNull();
  });

  it('rate limits session imports', async () => {
    const serialized = JSON.stringify({
      sessionId: '123e4567-e89b-12d3-a456-426614174222',
      messages: [],
    });
    const calls = Array.from({ length: SESSION_IMPORTS_PER_MINUTE + 1 }, () =>
      importSession(serialized),
    );
    const results = await Promise.all(calls);
    const successes = results.filter(r => r !== null);
    expect(successes.length).toBe(SESSION_IMPORTS_PER_MINUTE);
  });

  it('regenerates sessionId if signature mismatch', async () => {
    const store: Record<string, string> = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
    };
    const id1 = await getSessionId();
    store[SESSION_ID_STORAGE_KEY] = `${SESSION_ID_VERSION}:${id1}.bogus`;
    const id2 = await getSessionId();
    expect(id2).not.toBe(id1);
    expect(store[SESSION_ID_STORAGE_KEY]).toBe(
      `${SESSION_ID_VERSION}:${id2}.${await __signSessionId(id2)}`,
    );
  });

  it('accepts signatures from rotated secrets', async () => {
    vi.stubEnv('SESSION_ID_SECRET', `${'b'.repeat(64)},${'a'.repeat(64)}`);
    vi.resetModules();
    const { getSessionId, __signSessionId } = await import('@/lib/sessionCache');
    const { SESSION_ID_STORAGE_KEY } = await import('@/constants');
    const store: Record<string, string> = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
    };
    const sessionId = '123e4567-e89b-12d3-a456-426614174888';
    store[SESSION_ID_STORAGE_KEY] = `1:${sessionId}.${await __signSessionId(
      sessionId,
      'a'.repeat(64),
      1,
    )}`;
    const id = await getSessionId();
    expect(id).toBe(sessionId);
    vi.unstubAllEnvs();
  });

  it('sanitizes message content on append', () => {
    const sessionId = 'xss';
    appendSessionContext(sessionId, {
      role: 'user',
      content: '<img src=x onerror=alert(1)>',
      timestamp: Date.now(),
    });
    const ctx = loadSessionContext(sessionId);
    expect(ctx[0].content).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('validates imported session', async () => {
    const bad = JSON.stringify({
      sessionId: 's',
      messages: [{ role: 'bad', content: 1, timestamp: 'x' }],
    });
    const res = await importSession(bad);
    expect(res).toBeNull();
  });

  it('sanitizes imported messages', async () => {
    const serialized = JSON.stringify({
      sessionId: '123e4567-e89b-12d3-a456-426614174333',
      messages: [{ role: 'user', content: '<b>hi</b>', timestamp: Date.now() }],
    });
    const id = await importSession(serialized);
    expect(id).toBe('123e4567-e89b-12d3-a456-426614174333');
    const ctx = loadSessionContext('123e4567-e89b-12d3-a456-426614174333');
    expect(ctx[0].content).toBe('&lt;b&gt;hi&lt;/b&gt;');
  });

  it('caps imported messages to max entries', async () => {
    const now = Date.now();
    const messages = Array.from({ length: SESSION_CACHE_MAX_ENTRIES + 5 }, (_, i) => ({
      role: 'user' as const,
      content: `m${i}`,
      timestamp: now + i,
    }));
    const serialized = JSON.stringify({
      sessionId: '123e4567-e89b-12d3-a456-426614174444',
      messages,
    });
    setNavigator({
      storage: { estimate: () => Promise.resolve({ usage: 0, quota: 100 }) },
    });
    await importSession(serialized);
    const ctx = loadSessionContext('123e4567-e89b-12d3-a456-426614174444');
    expect(ctx).toHaveLength(SESSION_CACHE_MAX_ENTRIES);
    expect(ctx[0].content).toBe(`m${messages.length - SESSION_CACHE_MAX_ENTRIES}`);
    expect(ctx[ctx.length - 1].content).toBe(`m${messages.length - 1}`);
  });

  it('uses configurable keep ratio when summarizing', async () => {
    const sessionId = 'ratio';
    const base = Date.now();
    for (let i = 0; i < 4; i++) {
      appendSessionContext(sessionId, {
        role: 'user',
        content: `m${i}`,
        timestamp: base + i,
      });
    }
    const summarizer = vi.fn(async () => 'sum');
    await summarizeSessionIfNeeded(sessionId, summarizer, 0, 0.25);
    const ctx = loadSessionContext(sessionId);
    expect(ctx.some(m => m.content === 'm0')).toBe(false);
    expect(summarizer).toHaveBeenCalledOnce();
  });

  it('drops messages with invalid hash', () => {
    const sessionId = 'hash';
    appendSessionContext(sessionId, {
      role: 'user',
      content: 'hello',
      timestamp: Date.now(),
    });
    const stored = __cache.get(sessionId)!;
    stored[0].content = 'tamper';
    const ctx = loadSessionContext(sessionId);
    expect(ctx).toHaveLength(0);
  });

  it('shrinks cache under storage pressure', async () => {
    const sessionId = 'pressure';
    for (let i = 0; i < 20; i++) {
      appendSessionContext(sessionId, {
        role: 'user',
        content: `m${i}`,
        timestamp: Date.now() + i,
      });
    }
    setNavigator({
      storage: {
        estimate: () => Promise.resolve({ usage: 100, quota: 100 }),
      },
    });
    await __adjustCacheSize();
    expect(__getMaxEntries()).toBeLessThan(SESSION_CACHE_MAX_ENTRIES);
  });

  it('skips cache shrink when quota is unknown', async () => {
    const sessionId = 'noquota';
    appendSessionContext(sessionId, {
      role: 'user',
      content: 'm',
      timestamp: Date.now(),
    });
    setNavigator({});
    await __adjustCacheSize();
    expect(__getMaxEntries()).toBe(SESSION_CACHE_MAX_ENTRIES);
  });

  it('handles storage estimate errors gracefully', async () => {
    setNavigator({
      storage: {
        estimate: () => Promise.reject(new Error('Storage API error')),
      },
    });
    await __adjustCacheSize();
    expect(__getMaxEntries()).toBe(SESSION_CACHE_MAX_ENTRIES);
  });

  it('handles zero or undefined quota values', async () => {
    setNavigator({
      storage: {
        estimate: () => Promise.resolve({ usage: 100, quota: 0 }),
      },
    });
    await __adjustCacheSize();
    expect(__getMaxEntries()).toBe(SESSION_CACHE_MAX_ENTRIES);

    __clearSessionCache(true);
    setNavigator({
      storage: {
        estimate: () => Promise.resolve({ usage: 100 }),
      },
    });
    await __adjustCacheSize();
    expect(__getMaxEntries()).toBe(SESSION_CACHE_MAX_ENTRIES);
  });
});
