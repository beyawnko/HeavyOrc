import { fetchRelevantMemories, MemoryEntry } from '@/services/cipherService';
import { loadSessionContext, CachedMessage } from '@/lib/sessionCache';
import { escapeHtml } from '@/lib/utils';

export interface ContextualPrompt {
  prompt: string;
  memories: MemoryEntry[];
  sessionContext: CachedMessage[];
}

export async function buildContextualPrompt(
  userPrompt: string,
  sessionId: string,
): Promise<ContextualPrompt> {
  let prompt = userPrompt;
  const memories = await fetchRelevantMemories(userPrompt, sessionId);
  if (memories.length > 0) {
    const memoryText = memories.map(m => escapeHtml(m.content)).join('\n');
    prompt = `Context from previous interactions:\n${memoryText}\n\n${prompt}`;
  }
  const sessionContext = loadSessionContext(sessionId);
  if (sessionContext.length > 0) {
    const sessionText = sessionContext
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${escapeHtml(m.content)}`)
      .join('\n');
    prompt = `Recent session context:\n${sessionText}\n\n${prompt}`;
  }
  return { prompt, memories, sessionContext };
}
