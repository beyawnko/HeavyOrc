const SENSITIVE_KEY_PATTERNS = [
  /auth(orization)?/i,
  /token/i,
  /password/i,
  /secret/i,
  /key/i,
  /credential/i,
  /api[-_]?key/i,
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
        const message = (parsed as { message?: string }).message?.slice(0, 1000) || '[REDACTED: Response too large]';
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
