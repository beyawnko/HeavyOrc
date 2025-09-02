export function logMemory(event: string, data: Record<string, unknown> = {}): void {
  console.debug({ source: 'memory', event, ...data });
}
