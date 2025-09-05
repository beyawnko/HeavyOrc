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
    const limit =
      this.maxPerInterval >= 20
        ? Math.floor(this.maxPerInterval * 0.95)
        : this.maxPerInterval;
    return this.timestamps.length < limit;
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
    while (this.timestamps.length > 0 && now - this.timestamps[0] >= this.intervalMs) {
      this.timestamps.shift();
    }
  }
  recordAction(): void {
    this.timestamps.push(Date.now());
  }
}
