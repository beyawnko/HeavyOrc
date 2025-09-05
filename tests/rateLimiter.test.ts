import { RateLimiter } from '@/lib/rateLimiter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('RateLimiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('limits actions per interval with sliding window', () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.canProceed()).toBe(true);
    rl.recordAction();
    expect(rl.canProceed()).toBe(true);
    rl.recordAction();
    expect(rl.canProceed()).toBe(false);
    vi.advanceTimersByTime(500);
    expect(rl.canProceed()).toBe(false);
    vi.advanceTimersByTime(500);
    expect(rl.canProceed()).toBe(true);
  });

  it('validates constructor inputs', () => {
    expect(() => new RateLimiter(0, 1000)).toThrow(
      'RateLimiter maxPerInterval must be positive, got: 0',
    );
    expect(() => new RateLimiter(1, 0)).toThrow(
      'RateLimiter intervalMs must be positive, got: 0',
    );
  });
});
