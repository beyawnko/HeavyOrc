import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { ExpertDispatch } from '@/moe/types';
import { GEMINI_FLASH_MODEL } from '@/constants';
import { MAX_GEMINI_TIMEOUT_MS, type GeminiAgentConfig } from '@/types';
import { getGeminiClient } from '@/services/llmService';

vi.mock('@/services/llmService', () => ({
  getGeminiClient: vi.fn(),
  getOpenAIClient: vi.fn(),
  getOpenRouterApiKey: vi.fn(),
  callWithRetry: vi.fn(),
  fetchWithRetry: vi.fn(),
}));

describe('dispatcher Gemini failure handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    process.env.GEMINI_RETRY_COUNT = '0';
    process.env.GEMINI_BACKOFF_MS = '1';
  });

  afterEach(() => {
    delete process.env.GEMINI_RETRY_COUNT;
    delete process.env.GEMINI_BACKOFF_MS;
  });

  it('records a failed draft when Gemini returns 503 and continues with others', async () => {
    const generateContentStream = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          yield { text: () => 'ok' };
        },
      });

    (getGeminiClient as unknown as Mock).mockReturnValue({
      models: { generateContentStream },
    });
    const { dispatch } = await import('@/moe/dispatcher');

    const experts: ExpertDispatch[] = [
      { agentId: 'fail', provider: 'gemini', model: GEMINI_FLASH_MODEL, id: '1', name: 'fail', persona: '' },
      { agentId: 'ok', provider: 'gemini', model: GEMINI_FLASH_MODEL, id: '2', name: 'ok', persona: '' },
    ];

    const baseConfig = {
      provider: 'gemini',
      model: GEMINI_FLASH_MODEL,
      status: 'PENDING',
      settings: {
        effort: 'low',
        generationStrategy: 'single',
        confidenceSource: 'judge',
        traceCount: 1,
        deepConfEta: 90,
        tau: 0.95,
        groupWindow: 2048,
      },
    } as const;

    const configs: GeminiAgentConfig[] = [
      { ...baseConfig, id: 'fail', expert: experts[0] },
      { ...baseConfig, id: 'ok', expert: experts[1] },
    ];

    const drafts = await dispatch(experts, 'prompt', [], configs, () => {}, undefined);

    const failDraft = drafts.find(d => d.agentId === 'fail');
    const okDraft = drafts.find(d => d.agentId === 'ok');

    expect(failDraft?.status).toBe('FAILED');
    expect(okDraft?.status).toBe('COMPLETED');
    expect(okDraft?.content).toBe('ok');
  });
});

describe('dispatcher Gemini streaming', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    process.env.GEMINI_RETRY_COUNT = '0';
    process.env.GEMINI_BACKOFF_MS = '1';
  });

  afterEach(() => {
    delete process.env.GEMINI_RETRY_COUNT;
    delete process.env.GEMINI_BACKOFF_MS;
  });

  const baseConfig = {
    provider: 'gemini',
    model: GEMINI_FLASH_MODEL,
    status: 'PENDING',
    settings: {
      effort: 'low',
      generationStrategy: 'single',
      confidenceSource: 'judge',
      traceCount: 1,
      deepConfEta: 90,
      tau: 0.95,
      groupWindow: 2048,
    },
  } as const;

  it('concatenates multiple stream chunks', async () => {
    const generateContentStream = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { text: () => 'hello ' };
        yield { text: () => 'world' };
      },
    });

    (getGeminiClient as unknown as Mock).mockReturnValue({
      models: { generateContentStream },
    });
    const { dispatch } = await import('@/moe/dispatcher');

    const expert: ExpertDispatch = {
      agentId: 'multi',
      provider: 'gemini',
      model: GEMINI_FLASH_MODEL,
      id: '1',
      name: 'multi',
      persona: '',
    };
    const config: GeminiAgentConfig = { ...baseConfig, id: 'multi', expert };

    const drafts = await dispatch([expert], 'prompt', [], [config], () => {}, undefined);

    expect(drafts[0].content).toBe('hello world');
  });

  it('returns partial result when stream errors', async () => {
    const generateContentStream = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { text: () => 'partial' };
        throw new Error('stream error');
      },
    });

    (getGeminiClient as unknown as Mock).mockReturnValue({
      models: { generateContentStream },
    });
    const { dispatch } = await import('@/moe/dispatcher');

    const expert: ExpertDispatch = {
      agentId: 'partial',
      provider: 'gemini',
      model: GEMINI_FLASH_MODEL,
      id: '1',
      name: 'partial',
      persona: '',
    };
    const config: GeminiAgentConfig = { ...baseConfig, id: 'partial', expert };

    const drafts = await dispatch([expert], 'prompt', [], [config], () => {}, undefined);

    expect(drafts[0].content).toBe('partial');
    expect(drafts[0].status).toBe('COMPLETED');
    expect(drafts[0].isPartial).toBe(true);
  });

  it('ignores empty stream chunks', async () => {
    const generateContentStream = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { text: () => 'a' };
        yield { text: () => 'b' };
        yield { text: () => 'c' };
      },
    });

    (getGeminiClient as unknown as Mock).mockReturnValue({ models: { generateContentStream } });

    const utils = await import('@/lib/utils');
    vi.spyOn(utils, 'getGeminiResponseText')
      .mockReturnValueOnce('hello ')
      .mockReturnValueOnce(null as any)
      .mockReturnValueOnce('world');

    const { dispatch } = await import('@/moe/dispatcher');

    const expert: ExpertDispatch = {
      agentId: 'empty',
      provider: 'gemini',
      model: GEMINI_FLASH_MODEL,
      id: '1',
      name: 'empty',
      persona: '',
    };
    const config: GeminiAgentConfig = { ...baseConfig, id: 'empty', expert };

    const drafts = await dispatch([expert], 'prompt', [], [config], () => {}, undefined);

    expect(drafts[0].content).toBe('hello world');
  });
});

describe('dispatcher Gemini timeout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    process.env.GEMINI_RETRY_COUNT = '0';
    process.env.GEMINI_BACKOFF_MS = '1';
  });

  afterEach(() => {
    delete process.env.GEMINI_RETRY_COUNT;
    delete process.env.GEMINI_BACKOFF_MS;
  });

  const baseConfig = {
    provider: 'gemini',
    model: GEMINI_FLASH_MODEL,
    status: 'PENDING',
    settings: {
      effort: 'low',
      generationStrategy: 'single',
      confidenceSource: 'judge',
      traceCount: 1,
      deepConfEta: 90,
      tau: 0.95,
      groupWindow: 2048,
    },
  } as const;

  it('fails when stream exceeds timeout before first chunk', async () => {
    const generateContentStream = vi.fn((params) => {
      const signal = params.config?.abortSignal;
      return {
        [Symbol.asyncIterator]: async function* () {
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, 1500);
            signal?.addEventListener('abort', () => {
              clearTimeout(t);
              resolve();
            });
          });
          if (signal?.aborted) {
            throw Object.assign(new Error('aborted'), { name: 'AbortError' });
          }
          yield { text: () => 'late' };
        },
      };
    });

    (getGeminiClient as unknown as Mock).mockReturnValue({ models: { generateContentStream } });
    const { dispatch } = await import('@/moe/dispatcher');

    const expert: ExpertDispatch = {
      agentId: 'timeout1',
      provider: 'gemini',
      model: GEMINI_FLASH_MODEL,
      id: '1',
      name: 'timeout1',
      persona: '',
    };
    const config: GeminiAgentConfig = { ...baseConfig, id: 'timeout1', expert, settings: { ...baseConfig.settings, timeoutMs: 1000 } };

    const drafts = await dispatch([expert], 'prompt', [], [config], () => {}, undefined);

    expect(drafts[0].status).toBe('FAILED');
    expect(drafts[0].error).toMatch(/^Expert "timeout1" exceeded the configured timeout/);
  });

  it('fails when timeout occurs during streaming', async () => {
    const generateContentStream = vi.fn((params) => {
      const signal = params.config?.abortSignal;
      return {
        [Symbol.asyncIterator]: async function* () {
          yield { text: () => 'early' };
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, 1500);
            signal?.addEventListener('abort', () => {
              clearTimeout(t);
              resolve();
            });
          });
          if (signal?.aborted) {
            throw Object.assign(new Error('aborted'), { name: 'AbortError' });
          }
          yield { text: () => 'late' };
        },
      };
    });

    (getGeminiClient as unknown as Mock).mockReturnValue({ models: { generateContentStream } });
    const { dispatch } = await import('@/moe/dispatcher');

    const expert: ExpertDispatch = {
      agentId: 'timeout2',
      provider: 'gemini',
      model: GEMINI_FLASH_MODEL,
      id: '1',
      name: 'timeout2',
      persona: '',
    };
    const config: GeminiAgentConfig = { ...baseConfig, id: 'timeout2', expert, settings: { ...baseConfig.settings, timeoutMs: 1000 } };

    const drafts = await dispatch([expert], 'prompt', [], [config], () => {}, undefined);

    expect(drafts[0].status).toBe('FAILED');
    expect(drafts[0].error).toMatch(/^Expert "timeout2" exceeded the configured timeout/);
  });

  it('handles minimum valid timeout correctly', async () => {
    const generateContentStream = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { text: () => 'ok' };
      },
    });

    (getGeminiClient as unknown as Mock).mockReturnValue({ models: { generateContentStream } });
    const { dispatch } = await import('@/moe/dispatcher');

    const expert: ExpertDispatch = {
      agentId: 'minTimeout',
      provider: 'gemini',
      model: GEMINI_FLASH_MODEL,
      id: '1',
      name: 'minTimeout',
      persona: '',
    };
    const config: GeminiAgentConfig = {
      ...baseConfig,
      id: 'minTimeout',
      expert,
      settings: { ...baseConfig.settings, timeoutMs: 1001 }
    };

    const drafts = await dispatch([expert], 'prompt', [], [config], () => {}, undefined);
    expect(drafts[0].status).toBe('COMPLETED');
  });

  it('handles maximum valid timeout correctly', async () => {
    const generateContentStream = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { text: () => 'ok' };
      },
    });

    (getGeminiClient as unknown as Mock).mockReturnValue({ models: { generateContentStream } });
    const { dispatch } = await import('@/moe/dispatcher');

    const expert: ExpertDispatch = {
      agentId: 'maxTimeout',
      provider: 'gemini',
      model: GEMINI_FLASH_MODEL,
      id: '1',
      name: 'maxTimeout',
      persona: '',
    };
    const config: GeminiAgentConfig = {
      ...baseConfig,
      id: 'maxTimeout',
      expert,
      settings: { ...baseConfig.settings, timeoutMs: MAX_GEMINI_TIMEOUT_MS - 1 }
    };

    const drafts = await dispatch([expert], 'prompt', [], [config], () => {}, undefined);
    expect(drafts[0].status).toBe('COMPLETED');
  });
});
