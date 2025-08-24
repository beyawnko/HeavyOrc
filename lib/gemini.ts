export type GeminiTextResult = { text?: string | (() => string) } | undefined | null;

export function extractGeminiText(src: GeminiTextResult): string {
    const textField = src && typeof src === 'object' ? src.text : undefined;
    const value = typeof textField === 'function' ? textField() : textField;
    return value ?? '';
}
