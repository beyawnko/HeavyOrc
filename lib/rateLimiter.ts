export class RateLimiter {
  private timestamps: number[] = [];
  constructor(private maxPerInterval: number, private intervalMs: number) {
    if (maxPerInterval <= 0) {
      throw new Error(
        `RateLimiter maxPerInterval must be positive, got: ${maxPerInterval}`,
      );
    }
    if (intervalMs <= 0) {
      throw new Error(
        `RateLimiter intervalMs must be positive, got: ${intervalMs}`,
      );
    }
  }
  canProceed(): boolean {
    const now = Date.now();
    this.pruneExpired(now);
    return this.timestamps.length < this.maxPerInterval;
  }
  getRemainingCapacity(): { remaining: number; resetMs: number } {
    const now = Date.now();
    this.pruneExpired(now);
    return {
      remaining: Math.max(0, this.maxPerInterval - this.timestamps.length),
      resetMs:
        this.timestamps.length > 0
          ? this.timestamps[0] + this.intervalMs - now
          : 0,
    };
  }
  private pruneExpired(now: number): void {
    if (!Number.isSafeInteger(now)) {
      this.timestamps = [];
      return;
    }
    while (this.timestamps.length > 0) {
      const diff = now - this.timestamps[0];
      if (!Number.isSafeInteger(diff) || diff < 0) {
        this.timestamps = [];
        break;
      }
      if (diff >= this.intervalMs) {
        this.timestamps.shift();
      } else {
        break;
      }
    }
    if (this.timestamps.length > this.maxPerInterval) {
      this.timestamps = this.timestamps.slice(-this.maxPerInterval);
    }
  }
  recordAction(): void {
    const now = Date.now();
    if (!Number.isSafeInteger(now)) return;
    this.pruneExpired(now);
    this.timestamps.push(now);
    if (this.timestamps.length > this.maxPerInterval) {
      this.timestamps.shift();
    }
  }
}
