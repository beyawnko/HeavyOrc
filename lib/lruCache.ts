import { MEMORY_PRESSURE_THRESHOLD } from '@/constants';

export class LRUCache<K, V> {
  private max: number;
  private cache = new Map<K, V>();

  constructor(max: number) {
    if (max <= 0) {
      throw new Error('LRUCache max size must be a positive number.');
    }
    this.max = max;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    const memoryInfo = performance.memory;
    if (
      memoryInfo &&
      memoryInfo.usedJSHeapSize >
        memoryInfo.jsHeapSizeLimit * MEMORY_PRESSURE_THRESHOLD
    ) {
      const toRemove = Math.ceil(this.cache.size / 2);
      const keys = Array.from(this.cache.keys()).slice(0, toRemove);
      keys.forEach(key => this.cache.delete(key));
      console.warn(
        `LRU cache evicted ${toRemove} entries due to memory pressure`,
      );
    }
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
