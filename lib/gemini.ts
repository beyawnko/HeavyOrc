export type GeminiTextResult = { text?: string | (() => string) } | undefined | null;

export function extractGeminiText(src: GeminiTextResult): string {
    return typeof src?.text === 'function' ? src.text() ?? '' : src?.text ?? '';
}
