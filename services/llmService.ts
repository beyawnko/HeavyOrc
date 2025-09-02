

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchWithTimeout = async (
    input: RequestInfo,
    init: RequestInit,
    timeoutMs = 5000,
    retries = 0,
    baseDelayMs = 500,
): Promise<Response> => {
    if (retries < 0) {
        throw new Error("retries must be non-negative");
    }
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeout = timeoutMs * (attempt + 1);
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const { signal } = init;
        let abortListener: (() => void) | undefined;
        if (signal) {
            if (signal.aborted) {
                controller.abort((signal as any).reason);
            } else {
                abortListener = () => controller.abort((signal as any).reason);
                signal.addEventListener('abort', abortListener, { once: true });
            }
        }

        try {
            const response = await fetch(input, { ...init, signal: controller.signal });
            clearTimeout(timeoutId);
            if (abortListener) {
                signal!.removeEventListener('abort', abortListener);
            }
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (abortListener) {
                signal!.removeEventListener('abort', abortListener);
            }
            if ((error as { name?: string }).name === 'AbortError') {
                if (signal?.aborted) {
                    throw error;
                }
                if (attempt === retries) {
                    throw new DOMException(`Request timeout after ${timeout}ms`, 'AbortError');
                }
            } else if (attempt === retries) {
                throw error;
            }
        }
        await sleep(baseDelayMs * Math.pow(2, attempt));
    }
    throw new Error("fetchWithTimeout exhausted all retries without success.");
};

export const fetchWithRetry = async (
    input: RequestInfo,
    init: RequestInit,
    retries = 3,
    baseDelayMs = 500,
    timeoutMs = 5000,
): Promise<Response> => {
    if (retries < 0) {
        throw new Error("retries must be non-negative");
    }
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetchWithTimeout(input, init, timeoutMs * (attempt + 1));
            const isServerError = response.status >= 500 && response.status < 600;
            if (!isServerError) {
                return response;
            }
            if (attempt === retries) {
                let url: string;
                if (typeof input === 'string') {
                    url = input;
                } else if (input instanceof URL) {
                    url = input.toString();
                } else if (input instanceof Request) {
                    url = input.url;
                } else {
                    url = String(input);
                }
                const serviceName = new URL(url).hostname;
                throw new Error(`${serviceName} service is temporarily unavailable. Please try again later.`);
            }
        } catch (error) {
            if ((error as { name?: string }).name === 'AbortError') {
                throw error; // don't retry aborted requests
            }
            if (attempt === retries) {
                throw error;
            }
        }
        await sleep(baseDelayMs * Math.pow(2, attempt));
    }
    // This path should be unreachable, but ensures type safety if the loop completes without returning.
    throw new Error("fetchWithRetry exhausted all retries without success.");
};

// callWithRetry now accepts functions that may return a promise or a synchronous value.
export const callWithRetry = async <T>(
    fn: () => Promise<T> | T,
    serviceName: string,
    retries = 3,
    baseDelayMs = 500,
): Promise<T> => {
    if (retries < 0) {
        throw new Error("retries must be non-negative");
    }
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if ((error as { name?: string }).name === 'AbortError') {
                throw error; // Don't retry aborted requests
            }
            const maybeError = error as { status?: number; response?: { status?: number } };
            const status = maybeError.status ?? maybeError.response?.status;
            const isRetryable = !status || (status >= 500 && status < 600);

            if (!isRetryable || attempt === retries) {
                if (isRetryable) {
                    throw new Error(`${serviceName} service is temporarily unavailable. Please try again later.`);
                }
                throw error;
            }
        }
        await sleep(baseDelayMs * Math.pow(2, attempt));
    }
    // This path should be unreachable, but ensures type safety if the loop completes without returning.
    throw new Error("callWithRetry exhausted all retries without success.");
};

let geminiClient: GoogleGenAI | undefined;
let currentGeminiApiKey: string | undefined;

export const setGeminiApiKey = (key: string) => {
    if (key && key !== currentGeminiApiKey) {
        currentGeminiApiKey = key;
        geminiClient = undefined; // Invalidate client to force re-creation with the new key
    }
}

export const getGeminiClient = (): GoogleGenAI => {
    if (geminiClient) {
        return geminiClient;
    }

    const apiKey = currentGeminiApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
        throw new Error("Gemini API key is missing. Please add it via the settings menu or ensure the GEMINI_API_KEY environment variable (or legacy API_KEY) is set.");
    }

    geminiClient = new GoogleGenAI({ apiKey });
    return geminiClient;
};

let openaiClient: OpenAI | undefined;
let currentOpenAIApiKey: string | undefined;

export const setOpenAIApiKey = (key: string) => {
    if (key && key !== currentOpenAIApiKey) {
        currentOpenAIApiKey = key;
        openaiClient = undefined; // Invalidate client to force re-creation with the new key
    }
}

export const getOpenAIClient = (): OpenAI => {
    if (openaiClient) {
        return openaiClient;
    }

    if (!currentOpenAIApiKey) {
        throw new Error("OpenAI API key is missing. Please add it via the settings menu to use OpenAI models.");
    }
    
    // NOTE: Using the OpenAI SDK in a browser environment is not recommended for production apps without a proxy.
    // This is done here for demonstration purposes.
    openaiClient = new OpenAI({ apiKey: currentOpenAIApiKey, dangerouslyAllowBrowser: true });
    return openaiClient;
};


let currentOpenRouterApiKey: string | undefined;

export const setOpenRouterApiKey = (key: string) => {
    if (key && key !== currentOpenRouterApiKey) {
        currentOpenRouterApiKey = key;
    }
};

export const getOpenRouterApiKey = (): string | undefined => {
    return currentOpenRouterApiKey;
};
