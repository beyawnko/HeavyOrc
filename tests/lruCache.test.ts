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
      'LRUCache max size must be positive, got: 0',
    );
    expect(() => new LRUCache<string, number>(-1)).toThrow(
      'LRUCache max size must be positive, got: -1',
    );
  });

  it('evicts entries under memory pressure', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = new LRUCache<string, number>(2, { checkInterval: 1 });
    cache.set('a', 1);
    cache.set('b', 2);
    vi.runAllTimers();
    const mem = (globalThis.performance as any).memory;
    mem.usedJSHeapSize = mem.jsHeapSizeLimit * MEMORY_PRESSURE_THRESHOLD + 1;
    cache.set('c', 3);
    vi.runAllTimers();
    expect(warn).toHaveBeenCalledWith(
      'LRU cache evicted 1 entries due to memory pressure',
    );
    expect(cache.size).toBe(1);
    expect(cache.has('c')).toBe(true);
    warn.mockRestore();
    vi.useRealTimers();
  });

  it('supports configurable thresholds and eviction ratios', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = new LRUCache<string, number>(4, {
      memoryPressureThreshold: 0.5,
      evictionRatio: 0.25,
      checkInterval: 1,
    });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    vi.runAllTimers();
    const mem = (globalThis.performance as any).memory;
    mem.usedJSHeapSize = mem.jsHeapSizeLimit * 0.6;
    cache.set('e', 5);
    vi.runAllTimers();
    expect(warn).toHaveBeenCalledWith(
      'LRU cache evicted 1 entries due to memory pressure',
    );
    expect(cache.size).toBe(3);
    expect(cache.has('e')).toBe(true);
    warn.mockRestore();
    vi.useRealTimers();
  });
});
