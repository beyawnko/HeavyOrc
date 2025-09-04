export class RateLimiter {
  private lastTime = 0;
  private count = 0;
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
    if (now - this.lastTime >= this.intervalMs) {
      this.lastTime = now;
      this.count = 0;
    }
    return this.count < this.maxPerInterval;
  }
  recordAction(): void {
    this.count++;
  }
}
