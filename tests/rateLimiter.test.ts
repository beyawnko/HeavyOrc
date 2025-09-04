import { RateLimiter } from '@/lib/rateLimiter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('RateLimiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('limits actions per interval', () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.canProceed()).toBe(true);
    rl.recordAction();
    expect(rl.canProceed()).toBe(true);
    rl.recordAction();
    expect(rl.canProceed()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(rl.canProceed()).toBe(true);
  });
});
