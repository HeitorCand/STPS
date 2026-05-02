import type { HeliusWebhookPayload } from "../types.js";
import { DRIFT_PROTOCOL_ADDRESS } from "../constants.js";

export function textIncludesAny(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

export function readProtocolAddress(payload: HeliusWebhookPayload): string {
  const eventProtocol = payload.events.protocolAddress;
  if (typeof eventProtocol === "string" && eventProtocol.length > 0) return eventProtocol;

  const accountProtocol = payload.accountData.find((item) => item.account.length > 0)?.account;
  if (accountProtocol) return accountProtocol;

  const instructionProtocol = payload.instructions.flatMap((instruction) => instruction.accounts)[0];
  return instructionProtocol ?? DRIFT_PROTOCOL_ADDRESS;
}

export function collectInstructionAccounts(payload: HeliusWebhookPayload): string[] {
  return payload.instructions.flatMap((instruction) => instruction.accounts);
}

