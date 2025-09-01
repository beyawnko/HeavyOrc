export function sanitizeErrorResponse(body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
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
      const BASE64_VALUE = /^[A-Za-z0-9+/=]{40,}$/;
      for (const [key, value] of Object.entries(parsed)) {
        if (SENSITIVE_PATTERNS.some(p => p.test(key)) || (typeof value === 'string' && BASE64_VALUE.test(value))) {
          (parsed as Record<string, unknown>)[key] = '[REDACTED]';
        }
      }
      return JSON.stringify(parsed);
    }
  } catch {
    // ignore parse errors
  }
  // Arrays and non-JSON responses are redacted to avoid leaking sensitive data
  return '[REDACTED]';
}
