import { describe, expect, test } from 'vitest';
import { sanitizeErrorResponse, validateUrl, readLimitedText, validateCsp } from '@/lib/security';
import { __deepFreeze } from '@/services/cipherService';

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

test('redacts API key variants', () => {
  const input = JSON.stringify({
    api_key_live_deadbeef: 'value',
    publicKey: 'pk_test_1234567890abcdef',
  });
  const output = sanitizeErrorResponse(input);
  expect(JSON.parse(output)).toEqual({
    api_key_live_deadbeef: '[REDACTED]',
    publicKey: '[REDACTED]',
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
    expect(validateUrl('https://example.com:8080', [], false)).toBeUndefined();
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
    expect(validateUrl('http://0x7f000001', [], false)).toBeUndefined();
    expect(validateUrl('http://017700000001', [], false)).toBeUndefined();
    expect(validateUrl('http://2130706433', [], false)).toBeUndefined();
    expect(validateUrl('http://127.1', [], false)).toBeUndefined();
    expect(validateUrl('http://[::ffff:127.0.0.1]', [], false)).toBeUndefined();
    expect(
      validateUrl('https://subdomain.1.2.3.4.com', [], false),
    ).toBe('https://subdomain.1.2.3.4.com');
    expect(validateUrl('https://example.com', ['example.com'], false)).toBe('https://example.com');
    expect(validateUrl('https://evil.com', ['example.com'], false)).toBeUndefined();
    expect(validateUrl('https://example.com:8080', [], false)).toBeUndefined();
    expect(validateUrl('ftp://example.com', [], false)).toBeUndefined();
  });

  test('rejects URLs with credentials', () => {
    expect(validateUrl('https://user:pass@example.com')).toBeUndefined();
  });

  test('rejects URLs with query or fragment', () => {
    expect(validateUrl('https://example.com/?q=1')).toBeUndefined();
    expect(validateUrl('https://example.com/#frag')).toBeUndefined();
  });

  test('rejects URLs with unsafe paths', () => {
    expect(validateUrl('https://example.com/..')).toBeUndefined();
    expect(validateUrl('https://example.com//evil')).toBeUndefined();
    expect(validateUrl('https://example.com/\\evil')).toBeUndefined();
    expect(validateUrl('https://example.com/ bad')).toBeUndefined();
    expect(validateUrl('https://example.com/\n')).toBeUndefined();
  });

  test('rejects non-normalized IPv6 hosts', () => {
    expect(
      validateUrl('https://[2001:4860:4860:0:0:0:0:8888]', [], false),
    ).toBeUndefined();
    expect(
      validateUrl('https://[2001:4860:4860::8888%25eth0]', [], false),
    ).toBeUndefined();
  });
});

describe('validateCsp', () => {
  test('accepts strict policy', () => {
    const headers = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none'; frame-src 'none'; navigate-to 'none'; frame-ancestors 'none'; sandbox; trusted-types 'none'; require-trusted-types-for 'script'",
    });
    const response = new Response('', { headers });
    expect(() => validateCsp(response)).not.toThrow();
  });

  test('rejects missing script-src', () => {
    const headers = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; style-src 'none'; frame-src 'none'; navigate-to 'none'; frame-ancestors 'none'; sandbox; trusted-types 'none'",
    });
    const response = new Response('', { headers });
    expect(() => validateCsp(response)).toThrow('Invalid CSP headers');
  });

  test('rejects unsafe style-src', () => {
    const headers = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src *; frame-src 'none'; navigate-to 'none'; frame-ancestors 'none'; sandbox; trusted-types 'none'",
    });
    const response = new Response('', { headers });
    expect(() => validateCsp(response)).toThrow('Invalid CSP headers');
  });

  test('rejects unsafe hashes', () => {
    const headers = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none' 'unsafe-hashes'; style-src 'none'; frame-src 'none'; navigate-to 'none'; frame-ancestors 'none'; sandbox; trusted-types 'none'",
    });
    const response = new Response('', { headers });
    expect(() => validateCsp(response)).toThrow('Invalid CSP headers');
  });

  test('rejects data sources and unsafe ancestors', () => {
    const headers = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none'; img-src data:; frame-src 'none'; navigate-to 'none'; frame-ancestors 'self'; sandbox; trusted-types 'none'",
    });
    const response = new Response('', { headers });
    expect(() => validateCsp(response)).toThrow('Invalid CSP headers');
  });

  test('rejects wasm-unsafe-eval and unsafe-hashed-attributes', () => {
    const headers1 = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none' 'wasm-unsafe-eval'; style-src 'none'; frame-src 'none'; navigate-to 'none'; frame-ancestors 'none'; sandbox; trusted-types 'none'",
    });
    const resp1 = new Response('', { headers: headers1 });
    expect(() => validateCsp(resp1)).toThrow('Invalid CSP headers');

    const headers2 = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none' 'unsafe-hashed-attributes'; frame-src 'none'; navigate-to 'none'; frame-ancestors 'none'; sandbox; trusted-types 'none'",
    });
    const resp2 = new Response('', { headers: headers2 });
    expect(() => validateCsp(resp2)).toThrow('Invalid CSP headers');
  });

  test('rejects missing sandbox or trusted-types', () => {
    const headers = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none'; frame-src 'none'; navigate-to 'none'; frame-ancestors 'none'",
    });
    const response = new Response('', { headers });
    expect(() => validateCsp(response)).toThrow('Invalid CSP headers');
    const headers2 = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none'; frame-src 'none'; navigate-to 'none'; frame-ancestors 'none'; sandbox; trusted-types default; require-trusted-types-for 'script'",
    });
    const resp2 = new Response('', { headers: headers2 });
    expect(() => validateCsp(resp2)).toThrow('Invalid CSP headers');
    const headers3 = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none'; frame-src 'none'; navigate-to 'none'; frame-ancestors 'none'; sandbox allow-scripts; trusted-types 'none'; require-trusted-types-for 'script'",
    });
    const resp3 = new Response('', { headers: headers3 });
    expect(() => validateCsp(resp3)).toThrow('Invalid CSP headers');
    const headers4 = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none'; frame-src 'none'; navigate-to 'none'; frame-ancestors 'none'; sandbox; trusted-types 'none'",
    });
    const resp4 = new Response('', { headers: headers4 });
    expect(() => validateCsp(resp4)).toThrow('Invalid CSP headers');
  });

  test('rejects missing frame-ancestors', () => {
    const headers = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none'; frame-src 'none'; navigate-to 'none'; sandbox; trusted-types 'none'",
    });
    const response = new Response('', { headers });
    expect(() => validateCsp(response)).toThrow('Invalid CSP headers');
  });

  test('rejects strict-dynamic and navigate-to self', () => {
    const headers1 = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none' 'strict-dynamic'; style-src 'none'; frame-src 'none'; navigate-to 'none'; frame-ancestors 'none'; sandbox; trusted-types 'none'; require-trusted-types-for 'script'",
    });
    const resp1 = new Response('', { headers: headers1 });
    expect(() => validateCsp(resp1)).toThrow('Invalid CSP headers');

    const headers2 = new Headers({
      'Content-Security-Policy':
        "default-src 'none'; connect-src 'self'; object-src 'none'; base-uri 'none'; script-src 'none'; style-src 'none'; frame-src 'none'; navigate-to 'self'; frame-ancestors 'none'; sandbox; trusted-types 'none'; require-trusted-types-for 'script'",
    });
    const resp2 = new Response('', { headers: headers2 });
    expect(() => validateCsp(resp2)).toThrow('Invalid CSP headers');
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

  test('does not over-redact unrelated keys', () => {
    const input = JSON.stringify({ monkey: 'banana' });
    const output = sanitizeErrorResponse(input);
    expect(JSON.parse(output)).toEqual({ monkey: 'banana' });
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

describe('deepFreeze', () => {
  test('rejects getters', () => {
    const obj: any = {};
    Object.defineProperty(obj, 'foo', { get() { return 1; } });
    expect(() => __deepFreeze(obj)).toThrow('foo');
  });

  test('rejects custom prototype', () => {
    const proto = { evil: true };
    const obj = Object.create(proto);
    obj.bar = 1;
    expect(() => __deepFreeze(obj)).toThrow('prototype');
  });

  test('rejects symbol properties', () => {
    const sym = Symbol('evil');
    const obj: any = { [sym]: 1 };
    expect(() => __deepFreeze(obj)).toThrow('symbol');
  });

  test('rejects function properties', () => {
    const obj: any = { fn: () => {} };
    expect(() => __deepFreeze(obj)).toThrow('fn');
  });

  test('rejects unsafe property names', () => {
    const obj: any = { 'bad name': 1 };
    expect(() => __deepFreeze(obj)).toThrow('bad name');
  });

  test('rejects non-configurable or non-writable properties', () => {
    const obj1: any = {};
    Object.defineProperty(obj1, 'a', { value: 1, configurable: false });
    expect(() => __deepFreeze(obj1)).toThrow('a');
    const obj2: any = {};
    Object.defineProperty(obj2, 'b', { value: 1, writable: false, configurable: true });
    expect(() => __deepFreeze(obj2)).toThrow('b');
  });
});
