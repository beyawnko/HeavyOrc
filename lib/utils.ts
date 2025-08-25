export const getAppUrl = (): string => {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'http://localhost';
};

export const getGeminiResponseText = (data: any): string => {
  try {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!parts) return '';
    return parts.map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('');
  } catch {
    return '';
  }
};
