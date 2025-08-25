export const getAppUrl = (): string =>
  typeof window !== 'undefined'
    ? window.location.origin
    : import.meta.env.VITE_APP_URL ?? '';

export const getGeminiResponseText = (response: unknown): string => {
  if (!response) return '';
  const textProp = Reflect.get(response as object, 'text') as unknown;
  return typeof textProp === 'function'
    ? textProp.call(response) ?? ''
    : (textProp as string | undefined) ?? '';
};
