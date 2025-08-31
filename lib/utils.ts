export const getAppUrl = (): string =>
  typeof window !== 'undefined' && window.location
    ? window.location.origin
    : import.meta.env.VITE_APP_URL ?? 'http://localhost';

export const getGeminiResponseText = (response: unknown): string => {
  if (!response) return '';
  // The Gemini SDK has evolved over time; depending on the version or
  // API surface, the response may expose its text either as a property or
  // a method. We reflectively access it and support both shapes.
  const textProp = Reflect.get(response as object, 'text') as unknown;
  return typeof textProp === 'function'
    ? textProp.call(response) ?? ''
    : (textProp as string | undefined) ?? '';
};

export const combineAbortSignals = (
  ...signals: (AbortSignal | undefined)[]
): { signal: AbortSignal; cleanup: () => void } => {
  const defined = signals.filter((s): s is AbortSignal => s != null);
  if (defined.length <= 1) {
    return { signal: defined[0] ?? new AbortController().signal, cleanup: () => {} };
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const s of defined) {
    if (s.aborted) controller.abort();
    else s.addEventListener('abort', onAbort);
  }
  const cleanup = () => {
    for (const s of defined) {
      s.removeEventListener('abort', onAbort);
    }
  };
  return { signal: controller.signal, cleanup };
};
