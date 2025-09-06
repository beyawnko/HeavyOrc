import { RATE_LIMITER_MAX_CAPACITY } from '@/constants';

export class RateLimiter {
  private buffer: number[];
  private start = 0;
  private count = 0;
  constructor(private maxPerInterval: number, private intervalMs: number) {
    if (
      typeof maxPerInterval !== 'number' ||
      !Number.isSafeInteger(maxPerInterval) ||
      maxPerInterval <= 0
    ) {
      throw new Error(
        `RateLimiter maxPerInterval must be a positive safe integer, got: ${maxPerInterval}`,
      );
    }
    if (
      typeof intervalMs !== 'number' ||
      !Number.isSafeInteger(intervalMs) ||
      intervalMs <= 0
    ) {
      throw new Error(
        `RateLimiter intervalMs must be a positive safe integer, got: ${intervalMs}`,
      );
    }
    if (maxPerInterval > RATE_LIMITER_MAX_CAPACITY) {
      throw new Error(
        `RateLimiter maxPerInterval must be <= ${RATE_LIMITER_MAX_CAPACITY}`,
      );
    }
    this.buffer = new Array(maxPerInterval);
  }
  canProceed(): boolean {
    const now = Date.now();
    this.pruneExpired(now);
    return this.count < this.maxPerInterval;
  }
  getRemainingCapacity(): { remaining: number; resetMs: number } {
    const now = Date.now();
    this.pruneExpired(now);
    return {
      remaining: Math.max(0, this.maxPerInterval - this.count),
      resetMs:
        this.count > 0
          ? this.buffer[this.start] + this.intervalMs - now
          : 0,
    };
  }
  private pruneExpired(now: number): void {
    if (!Number.isSafeInteger(now)) {
      this.start = 0;
      this.count = 0;
      return;
    }
    while (this.count > 0) {
      const diff = now - this.buffer[this.start];
      if (!Number.isSafeInteger(diff) || diff < 0) {
        this.start = 0;
        this.count = 0;
        break;
      }
      if (diff >= this.intervalMs) {
        this.start = (this.start + 1) % this.maxPerInterval;
        this.count--;
      } else {
        break;
      }
    }
  }
  recordAction(): void {
    const now = Date.now();
    if (!Number.isSafeInteger(now)) return;
    this.pruneExpired(now);
    this.buffer[(this.start + this.count) % this.maxPerInterval] = now;
    if (this.count < this.maxPerInterval) {
      this.count++;
    } else {
      this.start = (this.start + 1) % this.maxPerInterval;
    }
  }
}
