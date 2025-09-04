import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LRUCache } from '@/lib/lruCache';
import { MEMORY_PRESSURE_THRESHOLD } from '@/constants';

describe('LRUCache', () => {
  const originalPerformance = globalThis.performance;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'performance', {
      value: { memory: { usedJSHeapSize: 0, jsHeapSizeLimit: 100 } },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'performance', {
      value: originalPerformance,
      configurable: true,
    });
  });

  it('throws for non-positive max size', () => {
    expect(() => new LRUCache<string, number>(0)).toThrow(
      'LRUCache max size must be a positive number.',
    );
    expect(() => new LRUCache<string, number>(-1)).toThrow(
      'LRUCache max size must be a positive number.',
    );
  });

  it('clears cache under memory pressure', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
    const mem = (globalThis.performance as any).memory;
    mem.usedJSHeapSize = mem.jsHeapSizeLimit * MEMORY_PRESSURE_THRESHOLD + 1;
    cache.set('c', 3);
    expect(cache.size).toBe(1);
    expect(cache.has('c')).toBe(true);
    warn.mockRestore();
  });
});
