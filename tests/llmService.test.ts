import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@google/genai', () => {
  return { GoogleGenAI: vi.fn() };
});

describe('getGeminiClient environment variables', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;
  });

  it('uses GEMINI_API_KEY when set', async () => {
    process.env.GEMINI_API_KEY = 'env-key';
    const { getGeminiClient } = await import('@/services/llmService');
    const { GoogleGenAI } = await import('@google/genai');
    getGeminiClient();
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'env-key' });
  });

  it('falls back to API_KEY when GEMINI_API_KEY is absent', async () => {
    process.env.API_KEY = 'legacy-key';
    const { getGeminiClient } = await import('@/services/llmService');
    const { GoogleGenAI } = await import('@google/genai');
    getGeminiClient();
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'legacy-key' });
  });
});
