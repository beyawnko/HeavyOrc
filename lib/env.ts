export const getApiKey = (): string => {
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
        // As per guidelines, assume API_KEY is present. Throw a generic error if not.
        throw new Error("API_KEY environment variable not set.");
    }
    return apiKey;
};
