import { RateLimiter } from '@/lib/rateLimiter';
import { __consumeFromBucket } from '@/services/cipherService';
import * as securityUtils from '@/lib/securityUtils';
import { RATE_LIMITER_MAX_CAPACITY } from '@/constants';
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

  it('protects against timestamp overflow', () => {
    const rl: any = new RateLimiter(2, 1000);
    rl.buffer[0] = Number.MAX_SAFE_INTEGER;
    rl.count = 1;
    vi.setSystemTime(new Date(0));
    expect(rl.canProceed()).toBe(true);
    expect(rl.count).toBe(0);
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
    expect(() => new RateLimiter(RATE_LIMITER_MAX_CAPACITY + 1, 1000)).toThrow(
      `RateLimiter maxPerInterval must be <= ${RATE_LIMITER_MAX_CAPACITY}`,
    );
  });

  it('handles integer overflow in token buckets', () => {
    const buckets = new Map<string, { tokens: number; lastRefill: number }>();
    const key = 'test';
    buckets.set(key, { tokens: Number.MAX_SAFE_INTEGER, lastRefill: Number.MAX_SAFE_INTEGER });
    expect(__consumeFromBucket(buckets, key)).toBe(true);
    const bucket = buckets.get(key)!;
    expect(bucket.tokens).toBeLessThanOrEqual(30);
    expect(Number.isFinite(bucket.tokens)).toBe(true);
  });

  it('uses constant-time comparison for bucket keys', () => {
    const buckets = new Map<string, { tokens: number; lastRefill: number }>([
      ['a', { tokens: 1, lastRefill: Date.now() }],
      ['b', { tokens: 1, lastRefill: Date.now() }],
    ]);
    const spy = vi.spyOn(securityUtils, 'timingSafeEqual');
    expect(__consumeFromBucket(buckets, 'a')).toBe(true);
    expect(spy).toHaveBeenCalledTimes(buckets.size);
    spy.mockRestore();
  });

  it('bounds bucket map size', () => {
    const buckets = new Map<string, { tokens: number; lastRefill: number }>();
    __consumeFromBucket(buckets, 'a', 2);
    __consumeFromBucket(buckets, 'b', 2);
    __consumeFromBucket(buckets, 'c', 2);
    expect(buckets.size).toBeLessThanOrEqual(2);
  });
});
