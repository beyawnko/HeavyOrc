import { RunRecord } from '@/types';
import { fetchWithRetry } from '@/services/llmService';

export interface MemoryEntry {
  id: string;
  content: string;
}

const useCipher = import.meta.env.VITE_USE_CIPHER_MEMORY === 'true';
const baseUrl = import.meta.env.VITE_CIPHER_SERVER_URL ?? 'http://localhost:3000';

export const storeRunRecord = async (run: RunRecord): Promise<void> => {
  if (!useCipher) return;
  try {
    const response = await fetchWithRetry(`${baseUrl}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run }),
    });
    if (!response.ok) {
      console.warn('Failed to store run record');
    }
  } catch {
    // Swallow errors to avoid breaking the app when memory is unreachable
  }
};

export const fetchRelevantMemories = async (query: string): Promise<MemoryEntry[]> => {
  if (!useCipher) return [];
  try {
    const response = await fetchWithRetry(`${baseUrl}/memories/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json() as { memories?: MemoryEntry[] };
    return Array.isArray(data.memories) ? data.memories : [];
  } catch {
    return [];
  }
};
