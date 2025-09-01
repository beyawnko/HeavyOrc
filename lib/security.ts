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

const BASE64_VALUE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64_SHORT = /^[A-Za-z0-9+/]{16,}={0,2}$/;

function isSensitiveString(value: string): boolean {
  return (
    SENSITIVE_VALUE_PATTERNS.some(p => p.test(value)) ||
    (value.length >= 20 && BASE64_VALUE.test(value)) ||
    BASE64_SHORT.test(value)
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
