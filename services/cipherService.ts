import { RunRecord } from '@/types';
import { fetchWithRetry } from '@/services/llmService';

export interface MemoryEntry {
  id: string;
  content: string;
}

const useCipher = import.meta.env.VITE_USE_CIPHER_MEMORY === 'true';
const baseUrl = validateUrl(import.meta.env.VITE_CIPHER_SERVER_URL);

export function validateUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) && !isPrivateOrLocalhost(parsed.hostname) ? url : undefined;
  } catch {
    return undefined;
  }
}

function isPrivateOrLocalhost(hostname: string): boolean {
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  const lower = host.toLowerCase();
  return lower === 'localhost' ||
    lower === '::1' ||
    lower.startsWith('127.') ||
    lower.startsWith('192.168.') ||
    lower.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(lower) ||
    /^fe[89ab][0-9a-f]*:/i.test(lower) ||
    /^f[cd][0-9a-f]*:/i.test(lower);
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
      const errorData = await response.text().catch(() => 'Unable to read error response');
      console.error('Failed to store run record', {
        url: `${baseUrl}/memories`,
        status: response.status,
        statusText: response.statusText,
        body: errorData,
      });
    }
  } catch (e) {
    console.error('Failed to store run record', {
      url: `${baseUrl}/memories`,
      error: e,
    });
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
      const errorData = await response.text().catch(() => 'Unable to read error response');
      console.error('Failed to fetch memories', {
        url: `${baseUrl}/memories/search`,
        status: response.status,
        statusText: response.statusText,
        body: errorData,
      });
      return [];
    }
    const data = await response.json() as { memories?: MemoryEntry[] };
    return Array.isArray(data.memories) ? data.memories : [];
  } catch (e) {
    console.error('Failed to fetch relevant memories', {
      url: `${baseUrl}/memories/search`,
      error: e,
    });
    return [];
  }
};
