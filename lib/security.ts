const SENSITIVE_PATTERNS = [
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

const BASE64_VALUE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...obj };
  for (const [key, value] of Object.entries(sanitized)) {
    if (
      SENSITIVE_PATTERNS.some(p => p.test(key)) ||
      (typeof value === 'string' && value.length >= 40 && BASE64_VALUE.test(value))
    ) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

export function sanitizeErrorResponse(body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      return JSON.stringify(
        parsed.map(item =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? sanitizeObject(item)
            : item
        )
      );
    }
    if (parsed && typeof parsed === 'object') {
      return JSON.stringify(sanitizeObject(parsed as Record<string, unknown>));
    }
  } catch {
    // ignore parse errors
  }
  // For safety, non-JSON-object/array responses are fully redacted.
  return '[REDACTED]';
}
