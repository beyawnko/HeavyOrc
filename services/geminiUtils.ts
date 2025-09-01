export const GEMINI_QUOTA_MESSAGE = "Gemini quota exceeded, please try again in a few seconds.";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const isGeminiRateLimitError = (error: unknown): boolean => {
    if (typeof error !== 'object' || error === null) {
        return false;
    }
    const maybeError = error as { status?: number; response?: { status?: number }; message?: unknown };
    const status = maybeError.status ?? maybeError.response?.status;
    const rawMessage = maybeError.message;
    const message = typeof rawMessage === 'string' ? rawMessage.toLowerCase() : '';
    return status === 429 || message.includes('rate limit') || message.includes('quota');
};

export const isGeminiServerError = (error: unknown): boolean => {
    if (typeof error !== 'object' || error === null) {
        return false;
    }
    const maybeError = error as { status?: number; response?: { status?: number } };
    const status = maybeError.status ?? maybeError.response?.status;
    return typeof status === 'number' && status >= 500;
};

export interface GeminiRetryOpts {
    retries?: number;
    baseDelayMs?: number;
    timeoutMs?: number;
}

export const callWithGeminiRetry = async <T>(
    fn: (signal: AbortSignal) => Promise<T>,
    { retries = 3, baseDelayMs = 1000, timeoutMs = 10000 }: GeminiRetryOpts = {}
): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fn(controller.signal);
        } catch (error) {
            const isRateLimit = isGeminiRateLimitError(error);
            const isServerErr = isGeminiServerError(error);
            if ((isRateLimit || isServerErr) && attempt < retries) {
                await sleep(baseDelayMs * Math.pow(2, attempt));
                continue;
            }
            if (error instanceof Error && error.name === 'AbortError') {
                if (!controller.signal.aborted) {
                    throw error;
                }
                throw new Error('Gemini request timed out');
            }
            if (isRateLimit) {
                throw new Error(GEMINI_QUOTA_MESSAGE);
            }
            if (isServerErr) {
                const maybe = error as { status?: number; response?: { status?: number } };
                const status = maybe.status ?? maybe.response?.status;
                if (status === 503) {
                    throw new Error('Gemini service responded with 503 Service Unavailable after retries.');
                }
                throw new Error('Gemini service is temporarily unavailable. Please try again later.');
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const handleGeminiError = (error: unknown, context: string, action?: string): never => {
    console.error(`Error calling the Gemini API for ${context}:`, error);
    if (isGeminiRateLimitError(error)) {
        throw new Error(GEMINI_QUOTA_MESSAGE);
    }
    if (error instanceof Error) {
        throw new Error(`An error occurred with the Gemini ${capitalize(context)}: ${error.message}`);
    }
    throw new Error(`An unknown error occurred while communicating with the Gemini model for ${action ?? context}.`);
};
