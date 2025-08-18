
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export const geminiAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
