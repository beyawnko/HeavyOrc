const MAX_CACHE_SIZE = 1_000_000;

export class LRUCache<K, V> {
  private max: number;
  private cache = new Map<K, V>();

  constructor(max: number) {
    if (!Number.isInteger(max) || max <= 0 || max > MAX_CACHE_SIZE) {
      throw new Error(
        `LRUCache max size must be a positive integer not exceeding ${MAX_CACHE_SIZE}.`,
      );
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
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.max) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
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
