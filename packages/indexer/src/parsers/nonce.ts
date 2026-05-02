import type { GovernanceEvent, GovernanceEventType, HeliusWebhookPayload } from "../types.js";
import { SYSTEM_PROGRAM_ID } from "../constants.js";
import { collectInstructionAccounts, readProtocolAddress, textIncludesAny } from "./helpers.js";

export function parseNonceTransaction(payload: HeliusWebhookPayload): GovernanceEvent | null {
  const hasSystemInstruction = payload.instructions.some(
    (instruction) => instruction.programId === SYSTEM_PROGRAM_ID,
  );

  if (!hasSystemInstruction) return null;

  const eventType = detectNonceEventType(payload);
  if (!eventType) return null;

  return {
    type: eventType,
    protocolAddress: readProtocolAddress(payload),
    sourceProgram: "system-nonce",
    rawSignature: payload.signature,
    timestamp: payload.timestamp,
    metadata: {
      description: payload.description,
      feePayer: payload.feePayer,
      accounts: collectInstructionAccounts(payload),
      heliusType: payload.type,
    },
  };
}

function detectNonceEventType(payload: HeliusWebhookPayload): GovernanceEventType | null {
  const text = `${payload.type} ${payload.description} ${JSON.stringify(payload.events)} ${payload.instructions
    .map((instruction) => instruction.data)
    .join(" ")}`;

  if (textIncludesAny(text, ["nonceadvance", "advance nonce", "nonce advanced", "advanceNonce"])) {
    return "NONCE_ADVANCED";
  }

  if (textIncludesAny(text, ["nonceinitialize", "initialize nonce", "nonce account created", "create nonce", "initializeNonce"])) {
    return "NONCE_ACCOUNT_CREATED";
  }

  return null;
}

