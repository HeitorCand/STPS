export function logInfo(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, timestamp: Date.now(), ...fields }));
}

export function logError(event: string, error: unknown, fields: Record<string, unknown> = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ event, error: message, timestamp: Date.now(), ...fields }));
}

