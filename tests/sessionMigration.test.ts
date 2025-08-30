import { describe, it, expect } from 'vitest';
import { migrateAgentConfig } from '@/lib/sessionMigration';
import { OPENAI_AGENT_MODEL, OPENAI_GPT5_MINI_MODEL } from '@/constants';
import type { SavedAgentConfig, Expert, OpenAIAgentConfig } from '@/types';

describe('migrateAgentConfig', () => {
  const expertList: Expert[] = [{ id: 'test', name: 'Test', persona: '' }];

  it('handles a valid up-to-date OpenAI config', () => {
    const saved: SavedAgentConfig = {
      expertId: 'test',
      provider: 'openai',
      model: OPENAI_GPT5_MINI_MODEL,
      settings: {
        effort: 'high',
        verbosity: 'high',
        generationStrategy: 'single',
        confidenceSource: 'judge',
        traceCount: 8,
        deepConfEta: 90,
        tau: 0.95,
        groupWindow: 2048,
      },
    };

    const result = migrateAgentConfig(saved, expertList) as OpenAIAgentConfig | null;
    expect(result).not.toBeNull();
    expect(result?.model).toBe(OPENAI_GPT5_MINI_MODEL);
    expect(result?.settings.effort).toBe('high');
  });

  it('fills missing effort and verbosity with defaults', () => {
    const saved = {
      expertId: 'test',
      provider: 'openai',
      model: OPENAI_GPT5_MINI_MODEL,
      settings: {
        generationStrategy: 'single',
        confidenceSource: 'judge',
        traceCount: 8,
        deepConfEta: 90,
        tau: 0.95,
        groupWindow: 2048,
      },
    } as unknown as SavedAgentConfig;

    const result = migrateAgentConfig(saved, expertList) as OpenAIAgentConfig | null;
    expect(result).not.toBeNull();
    expect(result?.settings.effort).toBe('medium');
    expect(result?.settings.verbosity).toBe('medium');
  });

  it('defaults to a known model when model is invalid', () => {
    const saved = {
      expertId: 'test',
      provider: 'openai',
      model: 'invalid-model',
      settings: {
        generationStrategy: 'single',
        confidenceSource: 'judge',
        traceCount: 8,
        deepConfEta: 90,
        tau: 0.95,
        groupWindow: 2048,
      },
    } as unknown as SavedAgentConfig;

    const result = migrateAgentConfig(saved, expertList) as OpenAIAgentConfig | null;
    expect(result).not.toBeNull();
    expect(result?.model).toBe(OPENAI_AGENT_MODEL);
  });

  it('skips configs with unknown provider', () => {
    const saved = {
      expertId: 'test',
      provider: 'unknown',
      model: 'whatever',
      settings: {},
    } as unknown as SavedAgentConfig;

    const result = migrateAgentConfig(saved, expertList);
    expect(result).toBeNull();
  });

  it('skips configs with unknown expertId', () => {
    const saved: SavedAgentConfig = {
      expertId: 'missing',
      provider: 'openai',
      model: OPENAI_AGENT_MODEL,
      settings: {
        generationStrategy: 'single',
        confidenceSource: 'judge',
        traceCount: 8,
        deepConfEta: 90,
        tau: 0.95,
        groupWindow: 2048,
        effort: 'high',
        verbosity: 'high',
      },
    };

    const result = migrateAgentConfig(saved, expertList);
    expect(result).toBeNull();
  });
});
