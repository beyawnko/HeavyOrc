import { describe, it, expect, vi, afterEach } from 'vitest';
import { RunRecord } from '@/types';
import { GEMINI_PRO_MODEL } from '@/constants';

const sampleRun: RunRecord = {
  id: '1',
  timestamp: Date.now(),
  prompt: 'p',
  images: [],
  agentConfigs: [],
  arbiterModel: GEMINI_PRO_MODEL,
  openAIArbiterVerbosity: 'medium',
  openAIArbiterEffort: 'medium',
  geminiArbiterEffort: 'dynamic',
  finalAnswer: 'a',
  agents: [],
  status: 'COMPLETED',
  arbiterSwitchWarning: null,
};

const originalFetch = global.fetch;
const VALID_CSP_HEADER = {
  'Content-Security-Policy':
    "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none'",
};
const WILDCARD_CSP_HEADER = {
  'Content-Security-Policy':
    "default-src 'none'; connect-src *; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none'",
};
const UNSAFE_CSP_HEADER = {
  'Content-Security-Policy':
    "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'unsafe-inline'; style-src 'none'",
};
const DANGEROUS_CSP_HEADER = {
  'Content-Security-Policy':
    "default-src 'none'; connect-src 'self'; object-src *; base-uri *; script-src 'none'; style-src 'none'",
};
const MISSING_SCRIPT_CSP_HEADER = {
  'Content-Security-Policy':
    "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; style-src 'none'",
};
const MISSING_STYLE_CSP_HEADER = {
  'Content-Security-Policy':
    "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'",
};
const MEMORIES_RESPONSE = {
  memories: [
    { id: '1', content: 'note', meta: { nested: { value: 1 } } } as any,
  ],
};
const SESSION_ID = '123e4567-e89b-12d3-a456-426614174000';

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
  vi.resetModules();
  delete (globalThis as any).__TEST_IP__;
});

describe('cipherService', () => {
  it('stores run record when enabled', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock as any;
    const { storeRunRecord } = await import('@/services/cipherService');
    await storeRunRecord(sampleRun, SESSION_ID);
    expect(fetchMock).toHaveBeenCalledWith('http://cipher/memories/batch', expect.any(Object));
  });

  it('rejects invalid sessionId', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const mem = await import('@/lib/memoryLogger');
    const log = vi.spyOn(mem, 'logMemory').mockImplementation(() => {});
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun, 'invalid<script>')).rejects.toThrow(
      'Invalid session identifier format',
    );
    expect(log).toHaveBeenCalledWith('cipher.store.invalidSession', {
      sessionId: '1710d3a6e83be9a7bedaac4926807bcd1fe75cd9668c9249bf9822e0819518de',
    });
    log.mockRestore();
  });

  it('returns empty array and logs sanitized id for fetch with invalid sessionId', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const mem = await import('@/lib/memoryLogger');
    const log = vi.spyOn(mem, 'logMemory').mockImplementation(() => {});
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    const res = await fetchRelevantMemories('q', 'invalid<script>');
    expect(res).toEqual([]);
    expect(log).toHaveBeenCalledWith('cipher.fetch.invalidSession', {
      sessionId: '1710d3a6e83be9a7bedaac4926807bcd1fe75cd9668c9249bf9822e0819518de',
    });
    log.mockRestore();
  });

  it('throws when CSP header missing', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    vi.stubEnv('VITE_ENFORCE_CIPHER_CSP', 'true');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock as any;
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun, SESSION_ID)).rejects.toThrow('Missing CSP headers');
  });

  it.each([
    { name: 'wildcard', headers: WILDCARD_CSP_HEADER },
    { name: 'unsafe', headers: UNSAFE_CSP_HEADER },
    { name: 'dangerous', headers: DANGEROUS_CSP_HEADER },
    { name: 'missing script', headers: MISSING_SCRIPT_CSP_HEADER },
    { name: 'missing style', headers: MISSING_STYLE_CSP_HEADER },
  ])('throws when CSP header is $name', async ({ headers }) => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    vi.stubEnv('VITE_ENFORCE_CIPHER_CSP', 'true');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200, headers }));
    global.fetch = fetchMock as any;
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun, SESSION_ID)).rejects.toThrow('Invalid CSP headers');
  });

  it('resolves when CSP header valid', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    vi.stubEnv('VITE_ENFORCE_CIPHER_CSP', 'true');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200, headers: VALID_CSP_HEADER }));
    global.fetch = fetchMock as any;
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun, SESSION_ID)).resolves.toBeUndefined();
  });

  it('skips storing run record when an agent content exceeds limit', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    const { storeRunRecord } = await import('@/services/cipherService');
    const big = 'x'.repeat(5000);
    await storeRunRecord({
      ...sampleRun,
      agents: [
        {
          id: 'a',
          name: 'n',
          persona: '',
          status: 'COMPLETED',
          content: big,
          error: null,
          model: 'm',
          provider: 'openai',
        },
      ],
    }, SESSION_ID);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches memories when enabled', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    vi.stubEnv('VITE_ENFORCE_CIPHER_CSP', 'true');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(MEMORIES_RESPONSE), { status: 200, headers: VALID_CSP_HEADER })
      );
    global.fetch = fetchMock as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    const memories = await fetchRelevantMemories('q', SESSION_ID);
    expect(memories).toEqual(MEMORIES_RESPONSE.memories);
  });

  it('returns empty array for invalid sessionId', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ memories: [] }), { status: 200 }));
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    const memories = await fetchRelevantMemories('q', 'invalid');
    expect(memories).toEqual([]);
  });

  it('caches memories by query', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ memories: [] }), { status: 200 }));
    global.fetch = fetchMock as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    await fetchRelevantMemories('q1', SESSION_ID);
    await fetchRelevantMemories('q1', SESSION_ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent fetches', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const resp = new Response(JSON.stringify(MEMORIES_RESPONSE), { status: 200 });
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(resp.clone()), 10))
      );
    global.fetch = fetchMock as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    await Promise.all([fetchRelevantMemories('q2', SESSION_ID), fetchRelevantMemories('q2', SESSION_ID)]);
    await fetchRelevantMemories('q2', SESSION_ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });


  it('caches memory responses', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    vi.stubEnv('VITE_ENFORCE_CIPHER_CSP', 'true');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(MEMORIES_RESPONSE), { status: 200, headers: VALID_CSP_HEADER }));
    global.fetch = fetchMock as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    await fetchRelevantMemories('q', SESSION_ID);
    await fetchRelevantMemories('q', SESSION_ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('scopes cache per session', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(MEMORIES_RESPONSE), { status: 200 }));
    global.fetch = fetchMock as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    await fetchRelevantMemories('q', '00000000-0000-0000-0000-000000000001');
    await fetchRelevantMemories('q', '00000000-0000-0000-0000-000000000002');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    { name: 'missing', headers: undefined },
    { name: 'invalid', headers: WILDCARD_CSP_HEADER },
    { name: 'unsafe', headers: UNSAFE_CSP_HEADER },
    { name: 'dangerous', headers: DANGEROUS_CSP_HEADER },
    { name: 'no-script', headers: MISSING_SCRIPT_CSP_HEADER },
    { name: 'no-style', headers: MISSING_STYLE_CSP_HEADER },
  ])(
    'returns empty array when CSP header is $name and enforcement enabled',
    async ({ headers }) => {
      vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
      vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
      vi.stubEnv('VITE_ENFORCE_CIPHER_CSP', 'true');
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(MEMORIES_RESPONSE), { status: 200, headers })
        );
      global.fetch = fetchMock as any;
      const { fetchRelevantMemories } = await import('@/services/cipherService');
      const memories = await fetchRelevantMemories('q', SESSION_ID);
      expect(memories).toEqual([]);
    }
  );

  it('returns memories when CSP header invalid but enforcement disabled', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    vi.stubEnv('VITE_ENFORCE_CIPHER_CSP', 'false');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(MEMORIES_RESPONSE), {
          status: 200,
          headers: WILDCARD_CSP_HEADER,
        }),
      );
    global.fetch = fetchMock as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    const memories = await fetchRelevantMemories('q', SESSION_ID);
    expect(memories).toEqual(MEMORIES_RESPONSE.memories);
  });

  it('returns an empty array on network errors when fetching memories', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    global.fetch = vi.fn().mockRejectedValue(new Error('network')) as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    const empty = await fetchRelevantMemories('q', SESSION_ID);
    expect(empty).toEqual([]);
  });

  it('skips fetch when circuit breaker is open', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi.fn().mockRejectedValue(new Error('network')) as any;
    global.fetch = fetchMock;
    vi.doMock('@/services/llmService', () => ({
      fetchWithRetry: (url: RequestInfo, init?: RequestInit) =>
        fetch(url as any, init),
    }));
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    for (let i = 0; i < 5; i++) {
      await fetchRelevantMemories('q', SESSION_ID);
    }
    const res = await fetchRelevantMemories('q', SESSION_ID);
    expect(res).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('resets circuit breaker after timeout', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    vi.stubEnv('VITE_CIPHER_CIRCUIT_BREAKER_THRESHOLD', '2');
    vi.stubEnv('VITE_CIPHER_CIRCUIT_BREAKER_RESET_MS', '1000');
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0);
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ memories: [] })));
    global.fetch = fetchMock as any;
    vi.doMock('@/services/llmService', () => ({
      fetchWithRetry: (url: RequestInfo, init?: RequestInit) =>
        fetch(url as any, init),
    }));
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    await fetchRelevantMemories('q', SESSION_ID);
    await fetchRelevantMemories('q', SESSION_ID);
    const before = await fetchRelevantMemories('q', SESSION_ID);
    expect(before).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(2001);
    const after = await fetchRelevantMemories('q', SESSION_ID);
    expect(after).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
    rand.mockRestore();
  });

  it('no-ops when disabled', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'false');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', '');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    const { storeRunRecord, fetchRelevantMemories } = await import('@/services/cipherService');
    await storeRunRecord(sampleRun, SESSION_ID);
    const res = await fetchRelevantMemories('q', SESSION_ID);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res).toEqual([]);
  });

  it('propagates network errors when storing run record', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    global.fetch = vi.fn().mockRejectedValue(new Error('network')) as any;
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun, SESSION_ID)).rejects.toThrow('network');
  });

  it('redacts sensitive info in error responses', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const body = JSON.stringify({
      token: 'abc',
      Password: 'secret',
      certificate: 'cert',
      'connection-string': 'conn',
      'private_key': 'pk',
      session_id: 'sess',
      encoded: 'YWJjMTIzYWJjMTIzYWJjMTIzYWJjMTIzYWJjMTIz',
      shortEncoded: 'YWJjZGVmZ2hpamtsbW4=',
    });
    const headers = {
      'Content-Security-Policy': "default-src 'none'",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 400,
        statusText: 'fail',
        headers,
      }),
    );
    global.fetch = fetchMock as any;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun, SESSION_ID)).rejects.toThrow(
      'Failed to store run records with status 400',
    );
    const logged = consoleSpy.mock.calls[0][1] as any;
    expect(logged.body).toBe(
      '{"token":"[REDACTED]","Password":"[REDACTED]","certificate":"[REDACTED]","connection-string":"[REDACTED]","private_key":"[REDACTED]","session_id":"[REDACTED]","encoded":"[REDACTED]","shortEncoded":"[REDACTED]"}',
    );
    consoleSpy.mockRestore();
  });

  it('redacts arrays in error responses', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const headers = {
      'Content-Security-Policy': "default-src 'none'",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('[{"token":"abc"},"my-secret-token"]', {
        status: 400,
        statusText: 'fail',
        headers,
      }),
    );
    global.fetch = fetchMock as any;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun, SESSION_ID)).rejects.toThrow(
      'Failed to store run records with status 400',
    );
    const logged = consoleSpy.mock.calls[0][1] as any;
    expect(logged.body).toBe('[{"token":"[REDACTED]"},"[REDACTED]"]');
    consoleSpy.mockRestore();
  });

  it('recursively redacts nested data in error responses', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const headers = {
      'Content-Security-Policy': "default-src 'none'",
    };
    const responseBody = JSON.stringify({
      details: {
        token: 'abc',
        items: ['secret', { password: 'p' }],
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(responseBody, {
        status: 400,
        statusText: 'fail',
        headers,
      }),
    );
    global.fetch = fetchMock as any;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun, SESSION_ID)).rejects.toThrow(
      'Failed to store run records with status 400',
    );
    const logged = consoleSpy.mock.calls[0][1] as any;
    expect(logged.body).toBe('{"details":{"token":"[REDACTED]","items":["[REDACTED]",{"password":"[REDACTED]"}]}}');
    consoleSpy.mockRestore();
  });

  it('returns empty array when memory response too large', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    const big = { memories: [{ id: '1', content: 'x'.repeat(500000) }] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(big), { status: 200 }));
    global.fetch = fetchMock as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    await fetchRelevantMemories('q', SESSION_ID);
    const res = await fetchRelevantMemories('q', SESSION_ID);
    expect(res).toEqual([]);
  });

  it('rate limits memory storage', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const headers = { 'Content-Security-Policy': "default-src 'none'" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200, headers }));
    global.fetch = fetchMock as any;
    const { storeRunRecord } = await import('@/services/cipherService');
    for (let i = 0; i < 35; i++) {
      await storeRunRecord(sampleRun, SESSION_ID);
    }
    expect(fetchMock).toHaveBeenCalledTimes(30);
  });

  it('rate limits per session', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const headers = { 'Content-Security-Policy': "default-src 'none'" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200, headers }));
    global.fetch = fetchMock as any;
    const { storeRunRecord } = await import('@/services/cipherService');
    for (let i = 0; i < 35; i++) {
      await storeRunRecord(sampleRun, '00000000-0000-0000-0000-000000000001');
    }
    await storeRunRecord(sampleRun, '00000000-0000-0000-0000-000000000002');
    expect(fetchMock).toHaveBeenCalledTimes(30);
  });

  it('evicts cache after TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const headers = { 'Content-Security-Policy': "default-src 'none'" };
    const body = JSON.stringify(MEMORIES_RESPONSE);
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(body, { status: 200, headers })));
    global.fetch = fetchMock as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    await fetchRelevantMemories('q', SESSION_ID);
    await fetchRelevantMemories('q', SESSION_ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await fetchRelevantMemories('q', SESSION_ID);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('logs structured event on memory fetch', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const headers = { 'Content-Security-Policy': "default-src 'none'" };
    const body = JSON.stringify(MEMORIES_RESPONSE);
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200, headers }));
    global.fetch = fetchMock as any;
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    await fetchRelevantMemories('q', SESSION_ID);
    const hasEvent = debug.mock.calls.some(([arg]) =>
      typeof arg === 'object' &&
      (arg as any).event === 'cipher.fetch' &&
      (arg as any).count === 1,
    );
    expect(hasEvent).toBe(true);
    debug.mockRestore();
  });

  it('freezes cached memory entries', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    (globalThis as any).__TEST_IP__ = '1.1.1.1';
    const headers = { 'Content-Security-Policy': "default-src 'none'" };
    const body = JSON.stringify(MEMORIES_RESPONSE);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(body, { status: 200, headers }));
    global.fetch = fetchMock as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    const first = await fetchRelevantMemories('q', SESSION_ID);
    const second = await fetchRelevantMemories('q', SESSION_ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const res of [first, second]) {
      expect(Object.isFrozen(res[0])).toBe(true);
      expect(Object.isFrozen((res[0] as any).meta)).toBe(true);
      expect(Object.isFrozen((res[0] as any).meta.nested)).toBe(true);
      expect(() => {
        (res[0] as any).content = 'changed';
      }).toThrow(TypeError);
      expect(() => {
        (res[0] as any).meta.nested.value = 2;
      }).toThrow(TypeError);
    }
  });
});
