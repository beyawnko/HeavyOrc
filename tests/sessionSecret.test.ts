import { describe, expect, test, vi } from 'vitest';

describe('session secret', () => {
  test('throws on invalid secret in production', async () => {
    vi.stubEnv('SESSION_ID_SECRET', 'short');
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    await expect(import('@/constants')).rejects.toThrow('SESSION_ID_SECRET');
    vi.unstubAllEnvs();
  });
});

