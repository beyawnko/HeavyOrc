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
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock as any;
    const { storeRunRecord } = await import('@/services/cipherService');
    await storeRunRecord(sampleRun);
    expect(fetchMock).toHaveBeenCalledWith('http://cipher/memories', expect.any(Object));
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

  it('validates URLs and blocks private addresses', async () => {
    const { validateUrl } = await import('@/services/cipherService');
    expect(validateUrl('http://example.com')).toBe('http://example.com');
    expect(validateUrl('https://example.com')).toBe('https://example.com');
    expect(validateUrl('http://localhost')).toBeUndefined();
    expect(validateUrl('http://127.0.0.1')).toBeUndefined();
    expect(validateUrl('http://192.168.0.1')).toBeUndefined();
    expect(validateUrl('http://10.0.0.1')).toBeUndefined();
    expect(validateUrl('http://172.16.0.1')).toBeUndefined();
    expect(validateUrl('ftp://example.com')).toBeUndefined();
  });
});
