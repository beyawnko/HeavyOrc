import {
  MEMORY_PRESSURE_THRESHOLD,
  MEMORY_PRESSURE_EVICT_RATIO,
  MEMORY_PRESSURE_CHECK_INTERVAL,
} from '@/constants';

export class LRUCache<K, V> {
  private max: number;
  private cache = new Map<K, V>();
  private memoryPressureThreshold: number;
  private evictionRatio: number;
  private checkInterval: number;
  private isCheckingMemory = false;
  private lastCheckTime = 0;

  constructor(
    max: number,
    opts: {
      memoryPressureThreshold?: number;
      evictionRatio?: number;
      checkInterval?: number;
    } = {},
  ) {
    if (max <= 0) {
      throw new Error(`LRUCache max size must be positive, got: ${max}`);
    }
    if (
      opts.evictionRatio !== undefined &&
      (opts.evictionRatio <= 0 || opts.evictionRatio > 1)
    ) {
      throw new Error(
        `LRUCache evictionRatio must be greater than 0 and at most 1, got: ${opts.evictionRatio}`,
      );
    }
    if (opts.checkInterval !== undefined && opts.checkInterval <= 0) {
      throw new Error(
        `LRUCache checkInterval must be positive, got: ${opts.checkInterval}`,
      );
    }
    this.max = max;
    this.memoryPressureThreshold =
      opts.memoryPressureThreshold ?? MEMORY_PRESSURE_THRESHOLD;
    this.evictionRatio = opts.evictionRatio ?? MEMORY_PRESSURE_EVICT_RATIO;
    this.checkInterval =
      opts.checkInterval ?? MEMORY_PRESSURE_CHECK_INTERVAL;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  private scheduleMemoryCheck(): void {
    const now = Date.now();
    if (now - this.lastCheckTime < this.checkInterval) {
      return;
    }
    const cb = () => void this.checkMemoryPressure();
    const ric = globalThis.requestIdleCallback;
    if (typeof ric === 'function') {
      ric(cb, { timeout: 1000 });
    } else {
      setTimeout(cb, 100);
    }
  }

  private async checkMemoryPressure(): Promise<void> {
    if (this.isCheckingMemory || typeof performance === 'undefined') {
      return;
    }
    this.isCheckingMemory = true;
    this.lastCheckTime = Date.now();
    try {
      const perf = performance as Performance & { memory?: PerformanceMemory };
      let memoryInfo: PerformanceMemory | undefined;
      try {
        memoryInfo = perf.memory;
      } catch (e) {
        console.warn('Error accessing performance.memory', e);
        return;
      }
      let pressure = false;
      if (memoryInfo) {
        pressure =
          memoryInfo.usedJSHeapSize >
          memoryInfo.jsHeapSizeLimit * this.memoryPressureThreshold;
      } else if (typeof navigator !== 'undefined') {
        // Fallback for browsers without performance.memory (e.g. Firefox, Safari).
        // Use a coarse deviceMemory heuristic: on low-memory devices (<=4GB)
        // treat a near-capacity cache as memory pressure and trim entries.
        const nav = navigator as Navigator & { deviceMemory?: number };
        if (
          typeof nav.deviceMemory === 'number' &&
          nav.deviceMemory <= 4 &&
          this.cache.size > this.max * this.memoryPressureThreshold
        ) {
          pressure = true;
        }
      }
      if (pressure) {
        const minEntries = Math.max(Math.floor(this.cache.size * 0.1), 1);
        const toRemove = Math.min(
          Math.ceil(this.cache.size * this.evictionRatio),
          this.cache.size - minEntries,
        );
        const keys = Array.from(this.cache.keys()).slice(0, toRemove);
        keys.forEach(key => this.cache.delete(key));
        console.warn(
          `LRU cache evicted ${toRemove} entries due to memory pressure`,
        );
      }
    } finally {
      this.isCheckingMemory = false;
    }
  }

  set(key: K, value: V): void {
    this.scheduleMemoryCheck();
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.cache[Symbol.iterator]();
  }
}
