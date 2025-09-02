import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildContextualPrompt } from '@/lib/contextBuilder';
import * as cipherService from '@/services/cipherService';
import { appendSessionContext, __clearSessionCache } from '@/lib/sessionCache';

describe('buildContextualPrompt', () => {
  beforeEach(() => {
    __clearSessionCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes memories and session context', async () => {
    vi.spyOn(cipherService, 'fetchRelevantMemories').mockResolvedValue([{ id: 'm1', content: 'past' }]);
    const sessionId = 's1';
    appendSessionContext(sessionId, { role: 'user', content: 'hello', timestamp: 0 });
    const { prompt } = await buildContextualPrompt('current question', sessionId);
    expect(prompt).toContain('Context from previous interactions');
    expect(prompt).toContain('past');
    expect(prompt).toContain('Recent session context');
    expect(prompt).toContain('User: hello');
  });

  it('returns prompt when no context', async () => {
    vi.spyOn(cipherService, 'fetchRelevantMemories').mockResolvedValue([]);
    const { prompt } = await buildContextualPrompt('standalone', 's2');
    expect(prompt).toBe('standalone');
  });
});
