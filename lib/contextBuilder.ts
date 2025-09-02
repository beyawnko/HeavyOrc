import { fetchRelevantMemories, MemoryEntry } from '@/services/cipherService';
import {
  loadSessionContext,
  CachedMessage,
  summarizeSessionIfNeeded,
  Summarizer,
} from '@/lib/sessionCache';
import { escapeHtml } from '@/lib/utils';
import { SUMMARIZER_MAX_CHARS } from '@/constants';

export interface ContextualPrompt {
  prompt: string;
  memories: MemoryEntry[];
  sessionContext: CachedMessage[];
}

export function createDefaultSummarizer(maxLength = SUMMARIZER_MAX_CHARS): Summarizer {
  return async (text: string): Promise<string> => {
    if (!text) return '';
    try {
      const truncated = text.slice(0, maxLength);
      const match = truncated.match(/.*[.!?]['")\s]*/s);
      if (match) return match[0].trim();
      const wordMatch = truncated.match(/.*\b/);
      return (wordMatch ? wordMatch[0] : truncated).trim() + (text.length > maxLength ? '…' : '');
    } catch (e) {
      console.warn('Error in summarizer:', e);
      return text.slice(0, maxLength) + '…';
    }
  };
}

export async function buildContextualPrompt(
  userPrompt: string,
  sessionId: string,
  summarizer: Summarizer = createDefaultSummarizer(),
  options?: { summaryThreshold?: number; keepRatio?: number },
): Promise<ContextualPrompt> {
  await summarizeSessionIfNeeded(
    sessionId,
    summarizer,
    options?.summaryThreshold,
    options?.keepRatio,
  );
  let prompt = userPrompt;
  const memories = await fetchRelevantMemories(userPrompt, sessionId);
  if (memories.length > 0) {
    const memoryText = memories.map(m => escapeHtml(m.content)).join('\n');
    prompt = `Context from previous interactions:\n${memoryText}\n\n${prompt}`;
  }
  const sessionContext = loadSessionContext(sessionId);
  if (sessionContext.length > 0) {
    const sessionText = sessionContext
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    prompt = `Recent session context:\n${sessionText}\n\n${prompt}`;
  }
  return { prompt, memories, sessionContext };
}
