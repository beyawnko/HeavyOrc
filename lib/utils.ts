export const getAppUrl = (): string =>
  typeof window !== 'undefined'
    ? window.location.origin
    : import.meta.env.VITE_APP_URL ?? '';

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
