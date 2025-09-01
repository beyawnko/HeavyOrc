import { describe, it, expect, vi, afterEach } from 'vitest';
import { RunRecord } from '@/types';
import { GEMINI_PRO_MODEL } from '@/constants';

const sampleRun: RunRecord = {
  id: '1',
  timestamp: 0,
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

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('cipherService', () => {
  it('stores run record when enabled', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    const headers = {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'",
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200, headers }));
    global.fetch = fetchMock as any;
    const { storeRunRecord } = await import('@/services/cipherService');
    await storeRunRecord(sampleRun);
    expect(fetchMock).toHaveBeenCalledWith('http://cipher/memories', expect.any(Object));
  });

  it('skips storing run record when an agent content exceeds limit', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
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
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches memories when enabled', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    const data = { memories: [{ id: '1', content: 'note' }] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
    global.fetch = fetchMock as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    const memories = await fetchRelevantMemories('q');
    expect(memories).toEqual(data.memories);
  });

  it('returns an empty array on network errors when fetching memories', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    global.fetch = vi.fn().mockRejectedValue(new Error('network')) as any;
    const { fetchRelevantMemories } = await import('@/services/cipherService');
    const empty = await fetchRelevantMemories('q');
    expect(empty).toEqual([]);
  });

  it('no-ops when disabled', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'false');
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    const { storeRunRecord, fetchRelevantMemories } = await import('@/services/cipherService');
    await storeRunRecord(sampleRun);
    const res = await fetchRelevantMemories('q');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res).toEqual([]);
  });

  it('propagates network errors when storing run record', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    global.fetch = vi.fn().mockRejectedValue(new Error('network')) as any;
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun)).rejects.toThrow('network');
  });

  it('redacts sensitive info in error responses', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
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
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 400,
        statusText: 'fail',
        headers,
      })
    );
    global.fetch = fetchMock as any;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun)).rejects.toThrow('Failed to store run record');
    const logged = consoleSpy.mock.calls[0][1] as any;
    expect(logged.body).toBe(
      '{"token":"[REDACTED]","Password":"[REDACTED]","certificate":"[REDACTED]","connection-string":"[REDACTED]","private_key":"[REDACTED]","session_id":"[REDACTED]","encoded":"[REDACTED]","shortEncoded":"[REDACTED]"}'
    );
    consoleSpy.mockRestore();
  });

  it('redacts arrays in error responses', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    const headers = {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('[{"token":"abc"},"my-secret-token"]', {
        status: 400,
        statusText: 'fail',
        headers,
      })
    );
    global.fetch = fetchMock as any;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun)).rejects.toThrow('Failed to store run record with status 400');
    const logged = consoleSpy.mock.calls[0][1] as any;
    expect(logged.body).toBe('[{"token":"[REDACTED]"},"[REDACTED]"]');
    consoleSpy.mockRestore();
  });

  it('recursively redacts nested data in error responses', async () => {
    vi.stubEnv('VITE_USE_CIPHER_MEMORY', 'true');
    vi.stubEnv('VITE_CIPHER_SERVER_URL', 'http://cipher');
    const headers = {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'",
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
      })
    );
    global.fetch = fetchMock as any;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { storeRunRecord } = await import('@/services/cipherService');
    await expect(storeRunRecord(sampleRun)).rejects.toThrow('Failed to store run record with status 400');
    const logged = consoleSpy.mock.calls[0][1] as any;
    expect(logged.body).toBe('{"details":{"token":"[REDACTED]","items":["[REDACTED]",{"password":"[REDACTED]"}]}}');
    consoleSpy.mockRestore();
  });

  it('validates URLs in development', async () => {
    const { validateUrl } = await import('@/services/cipherService');
    expect(validateUrl('http://example.com')).toBe('http://example.com');
    expect(validateUrl('ftp://example.com')).toBeUndefined();
    expect(validateUrl('http://localhost')).toBe('http://localhost');
    expect(validateUrl('example.com')).toBeUndefined();
  });

  it('blocks private URLs in production', async () => {
    const { validateUrl } = await import('@/services/cipherService');
    expect(validateUrl('http://example.com')).toBe('http://example.com');
    expect(validateUrl('https://example.com')).toBe('https://example.com');
    expect(validateUrl('http://example.com:8080')).toBe('http://example.com:8080');
    expect(validateUrl('http://localhost', false)).toBeUndefined();
    expect(validateUrl('http://127.0.0.1', false)).toBeUndefined();
    expect(validateUrl('http://192.168.0.1', false)).toBeUndefined();
    expect(validateUrl('http://10.0.0.1', false)).toBeUndefined();
    expect(validateUrl('http://172.16.0.1', false)).toBeUndefined();
    expect(validateUrl('http://[::1]', false)).toBeUndefined();
    expect(validateUrl('http://[::]', false)).toBeUndefined();
    expect(validateUrl('http://[fd00::1]', false)).toBeUndefined();
    expect(validateUrl('http://[fe80::1]', false)).toBeUndefined();
    expect(validateUrl('http://[2001:db8::1]', false)).toBe('http://[2001:db8::1]');
    expect(validateUrl('http://[2001:db8:0:1::]', false)).toBe('http://[2001:db8:0:1::]');
    expect(validateUrl('http://[::ffff:192.168.0.1]', false)).toBeUndefined();
    expect(validateUrl('http://[fe80:::1]', false)).toBeUndefined();
    expect(validateUrl('ftp://example.com', false)).toBeUndefined();
  });
});
