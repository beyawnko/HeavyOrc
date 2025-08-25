export const GEMINI_QUOTA_MESSAGE = "Gemini quota exceeded, please wait before retrying.";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const isGeminiRateLimitError = (error: unknown): boolean => {
    const status = (error as any)?.status || (error as any)?.response?.status;
    const rawMessage = (error as any)?.message;
    const message = typeof rawMessage === 'string' ? rawMessage.toLowerCase() : '';
    return status === 429 || message.includes('rate limit') || message.includes('quota');
};

export const callWithGeminiRetry = async <T>(
    fn: () => Promise<T>,
    retries = 2,
    baseDelayMs = 1000,
): Promise<T> => {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (!isGeminiRateLimitError(error)) {
                throw error;
            }
            await sleep(baseDelayMs * Math.pow(2, attempt));
        }
    }
    return fn();
};
