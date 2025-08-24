export type GeminiTextResult = { text?: string | (() => string) } | undefined | null;

export function extractGeminiText(src: GeminiTextResult): string {
    const text = src?.text;
    return typeof text === 'function' ? text() : text ?? '';
}
