import type { HeliusWebhookPayload } from "../types.js";

export function textIncludesAny(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

/**
 * Tenta extrair o endereço do protocolo do payload do webhook.
 * Retorna null se não conseguir identificar o protocolo — o caller deve
 * descartar o evento em vez de atribuí-lo a um protocolo errado.
 */
export function readProtocolAddress(payload: HeliusWebhookPayload): string | null {
  const eventProtocol = payload.events.protocolAddress;
  if (typeof eventProtocol === "string" && eventProtocol.length > 0) return eventProtocol;

  const accountProtocol = payload.accountData.find((item) => item.account.length > 0)?.account;
  if (accountProtocol) return accountProtocol;

  const instructionProtocol = payload.instructions.flatMap((instruction) => instruction.accounts)[0];
  return instructionProtocol ?? null;
}

export function collectInstructionAccounts(payload: HeliusWebhookPayload): string[] {
  return payload.instructions.flatMap((instruction) => instruction.accounts);
}

