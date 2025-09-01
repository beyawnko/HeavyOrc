import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { ExpertDispatch } from '@/moe/types';
import { GEMINI_FLASH_MODEL } from '@/constants';
import type { GeminiAgentConfig } from '@/types';
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
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ text: () => 'ok' });

    (getGeminiClient as unknown as Mock).mockReturnValue({
      models: { generateContent },
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
