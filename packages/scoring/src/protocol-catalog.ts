function parseJsonMap<T>(input: string | undefined, fallback: T): T {
  if (!input) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

export function getProtocolAdminKeys(protocolAddress: string): string[] {
  const map = parseJsonMap<Record<string, string[]>>(process.env.PROTOCOL_ADMIN_KEYS_MAP, {});
  return map[protocolAddress] ?? [];
}

export function isKnownAdminSigner(protocolAddress: string, walletAddress: string): boolean {
  return getProtocolAdminKeys(protocolAddress).includes(walletAddress);
}
