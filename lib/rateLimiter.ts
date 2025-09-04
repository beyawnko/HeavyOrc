export class RateLimiter {
  private lastTime = 0;
  private count = 0;
  constructor(private maxPerInterval: number, private intervalMs: number) {}
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
