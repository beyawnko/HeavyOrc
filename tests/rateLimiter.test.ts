import { RateLimiter } from '@/lib/rateLimiter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
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

  it('reports remaining capacity and reset time', () => {
    const rl = new RateLimiter(2, 1000);
    let info = rl.getRemainingCapacity();
    expect(info.remaining).toBe(2);
    expect(info.resetMs).toBe(0);
    rl.recordAction();
    vi.advanceTimersByTime(400);
    info = rl.getRemainingCapacity();
    expect(info.remaining).toBe(1);
    expect(info.resetMs).toBe(600);
    vi.advanceTimersByTime(600);
    info = rl.getRemainingCapacity();
    expect(info.remaining).toBe(2);
    expect(info.resetMs).toBe(0);
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
