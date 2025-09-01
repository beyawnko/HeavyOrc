import { describe, expect, test } from 'vitest';
import { sanitizeErrorResponse } from '@/lib/security';

describe('sanitizeErrorResponse arrays', () => {
  test('retains non-sensitive array items', () => {
    const input = JSON.stringify([1, 'alpha', true, null]);
    const output = sanitizeErrorResponse(input);
    expect(JSON.parse(output)).toEqual([1, 'alpha', true, null]);
  });

  test('redacts sensitive array items', () => {
    const input = JSON.stringify(['token123', { password: 'secret' }]);
    const output = sanitizeErrorResponse(input);
    expect(JSON.parse(output)).toEqual(['[REDACTED]', { password: '[REDACTED]' }]);
  });

  test('handles nested arrays and mixed data', () => {
    const input = JSON.stringify([
      ['safe', 'token123', ['nested_password']],
      { safe: 'value', sensitive: 'apiKey123' },
    ]);
    const output = sanitizeErrorResponse(input);
    expect(JSON.parse(output)).toEqual([
      ['safe', '[REDACTED]', ['[REDACTED]']],
      { safe: 'value', sensitive: '[REDACTED]' },
    ]);
  });
});

describe('sanitizeErrorResponse limits', () => {
  test('redacts short base64 strings', () => {
    const input = JSON.stringify({ token: 'YWJjZA==' });
    const output = sanitizeErrorResponse(input);
    expect(JSON.parse(output)).toEqual({ token: '[REDACTED]' });
  });

  test('caps large responses', () => {
    const big = 'x'.repeat(40_000);
    const output = sanitizeErrorResponse(big);
    expect(output).toBe('[REDACTED: Response too large]');
  });
});
