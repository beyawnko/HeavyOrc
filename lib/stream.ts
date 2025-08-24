export async function* transformLLMStream<T>(
    stream: AsyncIterable<T>,
    extract: (chunk: T) => string | undefined | null,
): AsyncGenerator<{ text: string }> {
    for await (const chunk of stream) {
        const content = extract(chunk);
        if (content) {
            yield { text: content };
        }
    }
}
