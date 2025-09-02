import { fetchWithRetry } from '@/services/llmService';
import { describe, it, expect, vi, afterEach } from 'vitest';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('fetchWithRetry', () => {
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

  it('retries on timeout errors', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    global.fetch = fetchMock as any;
    const res = await fetchWithRetry('https://example.com', {}, 1, 0, 10);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

