export const GEMINI_QUOTA_MESSAGE = "Gemini quota exceeded, please wait before retrying.";

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

export const callWithGeminiRetry = async <T>(
    fn: () => Promise<T>,
    retries = 2,
    baseDelayMs = 1000,
): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if ((isGeminiRateLimitError(error) || isGeminiServerError(error)) && attempt < retries) {
                await sleep(baseDelayMs * Math.pow(2, attempt));
                continue;
            }
            if (isGeminiServerError(error)) {
                throw new Error('Gemini service is temporarily unavailable. Please try again later.');
            }
            throw error;
        }
    }
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const handleGeminiError = (error: unknown, context: string, action?: string): never => {
    console.error(`Error calling the Gemini API for ${context}:`, error);
    if (isGeminiRateLimitError(error)) {
        throw new Error(GEMINI_QUOTA_MESSAGE);
    }
    if (isGeminiServerError(error)) {
        throw new Error('Gemini service is temporarily unavailable. Please try again later.');
    }
    if (error instanceof Error) {
        throw new Error(`An error occurred with the Gemini ${capitalize(context)}: ${error.message}`);
    }
    throw new Error(`An unknown error occurred while communicating with the Gemini model for ${action ?? context}.`);
};
