import { escapeHtml } from '@/lib/utils';

export function formatErrorMessage(err: unknown): string {
  return err instanceof Error ? escapeHtml(err.message) : 'Unknown error';
}
