import * as ipaddr from 'ipaddr.js';

const SENSITIVE_KEY_PATTERNS = [
  /auth(orization)?/i,
  /token/i,
  /password/i,
  /secret/i,
  // Catch API key names including live/test variants and hex suffixes
  /\b(?:api[-_]?)?key(?:[-_](?:live|test))?(?:[-_][0-9a-f]{6,})?\b/i,
  /credential/i,
  /cert(ificate)?/i,
  /connection[-_]?string/i,
  /private[-_]?key/i,
  /session[-_]?id/i,
];

// Value patterns intentionally omit generic words like "key" to avoid
// over-redacting informative error messages (e.g. "Invalid API key").
const SENSITIVE_VALUE_PATTERNS = [
  /auth(orization)?/i,
  /token/i,
  /password/i,
  /secret/i,
  /api[-_]?key/i,
  /(?:sk|pk)_(?:live|test)_[0-9a-zA-Z]{16,}/,
  /credential/i,
  /cert(ificate)?/i,
  /connection[-_]?string/i,
  /private[-_]?key/i,
  /session[-_]?id/i,
];

const BASE64_VALUE = /^(?!.*[^A-Za-z0-9+/=])(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function shannonEntropy(str: string): number {
  const counts: Record<string, number> = {};
  for (const ch of str) counts[ch] = (counts[ch] || 0) + 1;
  const len = str.length;
  let entropy = 0;
  for (const c of Object.values(counts)) {
    const p = c / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function isHighEntropyBase64(value: string): boolean {
  if (value.length < 8 || !BASE64_VALUE.test(value)) return false;
  if (/^[A-Za-z]+$/.test(value) && !( /[A-Z]/.test(value) && /[a-z]/.test(value))) return false;
  return shannonEntropy(value) >= 2.5;
}

function isSensitiveString(value: string): boolean {
  return (
    SENSITIVE_VALUE_PATTERNS.some(p => p.test(value)) ||
    isHighEntropyBase64(value)
  );
}

/**
 * Recursively sanitizes data by redacting sensitive fields and values.
 * @param data - The data to sanitize
 * @returns A copy with sensitive information redacted
 */
function sanitize(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item): unknown => sanitize(item));
  }

  if (data && typeof data === 'object' && data !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (
        SENSITIVE_KEY_PATTERNS.some(p => p.test(key)) ||
        (typeof value === 'string' && isSensitiveString(value))
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitize(value);
      }
    }
    return sanitized;
  }

  if (typeof data === 'string' && isSensitiveString(data)) {
    return '[REDACTED]';
  }

  return data;
}

/**
 * Sanitizes an error response body by redacting sensitive information.
 * Non-JSON responses are fully redacted.
 */
export function sanitizeErrorResponse(body: string): string {
  const MAX_ERROR_SIZE = 32_768; // 32KB limit
  if (body.length > MAX_ERROR_SIZE) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && parsed !== null) {
        const sanitized = sanitize(parsed);
        const rawMsg = (parsed as { message?: unknown }).message;
        const message =
          typeof rawMsg === 'string'
            ? String(sanitize(rawMsg)).slice(0, 1000)
            : '[REDACTED: Response too large]';
        return JSON.stringify({ ...(sanitized as Record<string, unknown>), _truncated: true, message });
      }
    } catch {
      return '[REDACTED: Response too large]';
    }
    return '[REDACTED: Response too large]';
  }
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && parsed !== null) {
      return JSON.stringify(sanitize(parsed));
    }
  } catch {
    // ignore parse errors
  }
  // For safety, non-JSON-object/array responses are fully redacted.
  return '[REDACTED]';
}

function isPrivateOrLocalhost(hostname: string): boolean {
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (host === 'localhost' || /^localhost\./i.test(host)) return true;
  if (ipaddr.isValid(host)) {
    let parsed = ipaddr.parse(host);
    if (parsed.kind() === 'ipv6') {
      const ipv6 = parsed as ipaddr.IPv6;
      if (host.includes('%')) return true; // Block zone IDs
      if (ipv6.isIPv4MappedAddress()) {
        parsed = ipv6.toIPv4Address();
      }
    }
    const range = parsed.range();
    return [
      'loopback',
      'linkLocal',
      'uniqueLocal',
      'private',
      'unspecified',
      'broadcast',
      'multicast',
    ].includes(range);
  }
  // Block DNS rebinding or obfuscated IP forms
  return (
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?\d\d?)$/.test(host) || // Dotted decimal
    /^0x[0-9a-f]+$/i.test(host) || // Hexadecimal
    /^[0-7]+$/.test(host) || // Octal
    /^\d+$/.test(host) // Decimal integer
  );
}

export function validateUrl(
  url: string | undefined,
  allowedHosts: string[] = [],
  dev: boolean = import.meta.env.DEV,
): string | undefined {
  if (!url || url.length > 2048) return undefined;
  try {
    const parsed = new URL(url.normalize('NFKC'));
    if (parsed.username || parsed.password) return undefined;
    let hostname = parsed.hostname;
    if (!ipaddr.isValid(hostname)) {
      try {
        hostname = new URL(`http://${hostname}`).hostname;
      } catch {
        return undefined;
      }
    }
    const bareHost = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
    const allowedProtocols = ['http:', 'https:'];
    // Only allow standard HTTP/S ports to reduce SSRF risk
    const allowedPorts = ['', '80', '443'];
    if (
      !allowedProtocols.includes(parsed.protocol) ||
      hostname.length > 255 ||
      (!ipaddr.isValid(bareHost) && !/^(?!-)[a-zA-Z0-9-]+(?<!-)(?:\.[a-zA-Z0-9-]+)*$/.test(bareHost)) ||
      (!dev && (parsed.protocol !== 'https:' || isPrivateOrLocalhost(hostname) || (parsed.port && !allowedPorts.includes(parsed.port)))) ||
      (allowedHosts.length > 0 && !allowedHosts.includes(hostname))
    ) {
      return undefined;
    }
    parsed.hostname = hostname;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

export async function readLimitedText(
  response: Response,
  limit: number,
  timeout: number = 5000,
): Promise<string | undefined> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    if (!response.body) {
      const text = await Promise.race([
        response.text(),
        new Promise<string>((_, reject) =>
          controller.signal.addEventListener('abort', () => reject(new Error('timeout'))),
        ),
      ]).catch(() => undefined);
      if (text === undefined) return undefined;
      return text.length > limit ? undefined : text;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    let result = '';
    while (true) {
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener('abort', () => reject(new Error('timeout'))),
        ),
      ]);
      if (done) break;
      received += value.length;
      if (received > limit) {
        reader.cancel();
        return undefined;
      }
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
    return result;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function validateCsp(response: Response): void {
  const csp = response.headers.get('Content-Security-Policy');
  if (!csp) {
    console.error('Missing CSP headers from memory server');
    throw new Error('Missing CSP headers');
  }

  type CSPDirective = { name: string; sources: string[] };
  const parseDirective = (directive: string): CSPDirective => {
    const [name, ...sources] = directive.trim().split(/\s+/);
    return { name, sources };
  };

  const directives = csp
    .split(';')
    .map(d => d.trim())
    .filter(Boolean)
    .map(parseDirective)
    .filter(d => d.name && d.sources.length > 0);
  const defaultSrc = directives.find(d => d.name === 'default-src');
  const connectSrc = directives.find(d => d.name === 'connect-src');
  const objectSrc = directives.find(d => d.name === 'object-src');
  const baseUri = directives.find(d => d.name === 'base-uri');
  const scriptSrc = directives.find(d => d.name === 'script-src');
  const styleSrc = directives.find(d => d.name === 'style-src');
  const frameAncestors = directives.find(d => d.name === 'frame-ancestors');
  const formAction = directives.find(d => d.name === 'form-action');

  const hasUnsafeSource = directives.some(d =>
    d.sources.some(
      s =>
        s === "'unsafe-inline'" ||
        s === "'unsafe-eval'" ||
        s === "'unsafe-hashes'" ||
        s === "'unsafe-dynamic'" ||
        s === '*' ||
        s.startsWith('data:') ||
        s.startsWith('blob:') ||
        s.startsWith('filesystem:')
    ),
  );
  const isDefaultSrcStrict =
    !!defaultSrc &&
    defaultSrc.sources.length === 1 &&
    defaultSrc.sources[0] === "'none'";
  const isConnectSrcSelf =
    !!connectSrc &&
    connectSrc.sources.length === 1 &&
    connectSrc.sources[0] === "'self'";
  const isObjectSrcSafe =
    !objectSrc ||
    (objectSrc.sources.length === 1 && objectSrc.sources[0] === "'none'");
  const isBaseUriSafe =
    !baseUri || (baseUri.sources.length === 1 && baseUri.sources[0] === "'none'");
  const isScriptSrcSafe =
    !!scriptSrc && scriptSrc.sources.length === 1 && scriptSrc.sources[0] === "'none'";
  const isStyleSrcSafe =
    !!styleSrc && styleSrc.sources.length === 1 && styleSrc.sources[0] === "'none'";
  const isFrameAncestorsSafe =
    !frameAncestors ||
    (frameAncestors.sources.length === 1 && frameAncestors.sources[0] === "'none'");
  const isFormActionSafe =
    !formAction ||
    (formAction.sources.length === 1 && formAction.sources[0] === "'none'");

  if (
    !isDefaultSrcStrict ||
    !isConnectSrcSelf ||
    hasUnsafeSource ||
    !isObjectSrcSafe ||
    !isBaseUriSafe ||
    !isScriptSrcSafe ||
    !isStyleSrcSafe ||
    !isFrameAncestorsSafe ||
    !isFormActionSafe
  ) {
    console.error('Invalid or insufficient CSP headers from memory server');
    throw new Error('Invalid CSP headers');
  }
}

