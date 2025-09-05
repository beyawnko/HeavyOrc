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
    while (this.timestamps.length > 0 && now - this.timestamps[0] >= this.intervalMs) {
      this.timestamps.shift();
    }
    return this.timestamps.length < this.maxPerInterval;
  }
  recordAction(): void {
    this.timestamps.push(Date.now());
  }
}
