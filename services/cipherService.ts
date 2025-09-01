import { RunRecord } from '@/types';
import { fetchWithRetry } from '@/services/llmService';

export interface MemoryEntry {
  id: string;
  content: string;
}

const useCipher = import.meta.env.VITE_USE_CIPHER_MEMORY === 'true';
const baseUrl = validateUrl(import.meta.env.VITE_CIPHER_SERVER_URL);

function validateUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

export const storeRunRecord = async (run: RunRecord): Promise<void> => {
  if (!useCipher || !baseUrl) return;
  try {
    const response = await fetchWithRetry(`${baseUrl}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run }),
    });
    if (!response.ok) {
      console.warn(`Failed to store run record: ${response.status} ${response.statusText}`);
      const errorData = await response.text().catch(() => 'Unable to read error response');
      console.debug('Error details:', errorData);
    }
  } catch (e) {
    console.warn('Failed to store run record:', e);
    // Swallow errors to avoid breaking the app when memory is unreachable
  }
};

export const fetchRelevantMemories = async (query: string): Promise<MemoryEntry[]> => {
  if (!useCipher || !baseUrl) return [];
  try {
    const response = await fetchWithRetry(`${baseUrl}/memories/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      console.warn(`Failed to fetch memories, server responded with ${response.status}`);
      return [];
    }
    const data = await response.json() as { memories?: MemoryEntry[] };
    return Array.isArray(data.memories) ? data.memories : [];
  } catch (e) {
    console.warn('Failed to fetch relevant memories:', e);
    return [];
  }
};
