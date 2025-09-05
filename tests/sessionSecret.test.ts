import { describe, expect, test, vi } from 'vitest';

describe('session secret', () => {
  test('throws on low entropy secret in production', async () => {
    vi.stubEnv('SESSION_ID_SECRET', 'a'.repeat(32));
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    await expect(import('@/constants')).rejects.toThrow('entropy');
    vi.unstubAllEnvs();
  });
});

