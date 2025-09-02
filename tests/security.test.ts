import { describe, expect, test } from 'vitest';
import { sanitizeErrorResponse, validateUrl, readLimitedText, validateCsp } from '@/lib/security';

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

describe('validateUrl', () => {
  test('validates URLs in development', () => {
    expect(validateUrl('http://example.com')).toBe('http://example.com');
    expect(validateUrl('ftp://example.com')).toBeUndefined();
    expect(validateUrl('http://localhost')).toBe('http://localhost');
    expect(validateUrl('example.com')).toBeUndefined();
    expect(validateUrl('http://bücher.de')).toBe('http://xn--bcher-kva.de');
  });

  test('enforces https and blocks private URLs in production', () => {
    expect(validateUrl('http://example.com', [], false)).toBeUndefined();
    expect(validateUrl('https://example.com', [], false)).toBe('https://example.com');
    expect(validateUrl('http://example.com:8080', [], false)).toBeUndefined();
    expect(validateUrl('http://localhost', [], false)).toBeUndefined();
    expect(validateUrl('http://127.0.0.1', [], false)).toBeUndefined();
    expect(validateUrl('http://192.168.0.1', [], false)).toBeUndefined();
    expect(validateUrl('http://10.0.0.1', [], false)).toBeUndefined();
    expect(validateUrl('http://172.16.0.1', [], false)).toBeUndefined();
    expect(validateUrl('http://[::1]', [], false)).toBeUndefined();
    expect(validateUrl('http://[::]', [], false)).toBeUndefined();
    expect(validateUrl('http://[fd00::1]', [], false)).toBeUndefined();
    expect(validateUrl('http://[fe80::1]', [], false)).toBeUndefined();
    expect(validateUrl('http://[fe80::1%eth0]', [], false)).toBeUndefined();
    expect(validateUrl('https://example.com', ['example.com'], false)).toBe('https://example.com');
    expect(validateUrl('https://evil.com', ['example.com'], false)).toBeUndefined();
    expect(validateUrl('https://example.com:8080', [], false)).toBe('https://example.com:8080');
    expect(validateUrl('ftp://example.com', [], false)).toBeUndefined();
  });
});

describe('validateCsp', () => {
  test('accepts strict policy', () => {
    const headers = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none'",
    });
    const response = new Response('', { headers });
    expect(() => validateCsp(response)).not.toThrow();
  });

  test('rejects missing script-src', () => {
    const headers = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; style-src 'none'",
    });
    const response = new Response('', { headers });
    expect(() => validateCsp(response)).toThrow('Invalid CSP headers');
  });

  test('rejects unsafe style-src', () => {
    const headers = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src *",
    });
    const response = new Response('', { headers });
    expect(() => validateCsp(response)).toThrow('Invalid CSP headers');
  });
});

describe('readLimitedText', () => {
  test('times out when stream is slow', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        setTimeout(() => controller.enqueue(new TextEncoder().encode('a')), 20);
      },
    });
    const response = new Response(stream);
    const text = await readLimitedText(response, 10, 10);
    expect(text).toBeUndefined();
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

  test('redacts sensitive message in oversized JSON', () => {
    const bigMessage = 'token123' + 'x'.repeat(40_000);
    const input = JSON.stringify({ message: bigMessage });
    const output = sanitizeErrorResponse(input);
    const parsed = JSON.parse(output);
    expect(parsed._truncated).toBe(true);
    expect(parsed.message).toBe('[REDACTED]');
  });
});
