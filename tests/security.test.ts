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
  test('redacts high entropy base64 strings', () => {
    const secret = Buffer.from('secret').toString('base64');
    const input = JSON.stringify({ data: secret });
    const output = sanitizeErrorResponse(input);
    expect(JSON.parse(output)).toEqual({ data: '[REDACTED]' });
  });

  test('ignores low entropy base64-like strings', () => {
    const input = JSON.stringify({ data: 'AAAAAAAAAAAAAA==' });
    const output = sanitizeErrorResponse(input);
    expect(JSON.parse(output)).toEqual({ data: 'AAAAAAAAAAAAAA==' });
  });

  test('ignores plain alphanumeric strings', () => {
    const input = JSON.stringify({ data: 'abcdefgh' });
    const output = sanitizeErrorResponse(input);
    expect(JSON.parse(output)).toEqual({ data: 'abcdefgh' });
  });

  test('caps large responses', () => {
    const big = 'x'.repeat(40_000);
    const output = sanitizeErrorResponse(big);
    expect(output).toBe('[REDACTED: Response too large]');
  });

  test('truncates oversized JSON gracefully', () => {
    const bigMessage = 'x'.repeat(40_000);
    const input = JSON.stringify({ message: bigMessage, token: 'secret' });
    const output = sanitizeErrorResponse(input);
    const parsed = JSON.parse(output);
    expect(parsed._truncated).toBe(true);
    expect(parsed.message.length).toBe(1000);
    expect(parsed.token).toBe('[REDACTED]');
  });
});
