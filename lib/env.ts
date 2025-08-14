export const getApiKey = (): string => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("CRITICAL: API_KEY environment variable not set. The application will not function.");
        throw new Error("API_KEY environment variable not set.");
    }
    return apiKey;
};
