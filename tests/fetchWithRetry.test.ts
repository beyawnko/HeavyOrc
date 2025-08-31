import { fetchWithRetry } from '@/services/llmService';
import { describe, it, expect, vi, afterEach } from 'vitest';

const originalFetch = global.fetch;

describe('fetchWithRetry hostname extraction', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('extracts hostname from string URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    global.fetch = fetchMock as any;
    await expect(fetchWithRetry('https://example.com', {}, 0)).rejects.toThrow('example.com service is temporarily unavailable');
  });

  it('extracts hostname from Request object', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    global.fetch = fetchMock as any;
    const req = new Request('https://api.test.com/path');
    await expect(fetchWithRetry(req, {}, 0)).rejects.toThrow('api.test.com service is temporarily unavailable');
  });
});
