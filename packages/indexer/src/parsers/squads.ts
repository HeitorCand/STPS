import type { GovernanceEvent, HeliusWebhookPayload, GovernanceEventType } from "../types.js";
import { SQUADS_PROGRAM_ID } from "../constants.js";
import { collectInstructionAccounts, readProtocolAddress, textIncludesAny } from "./helpers.js";

export function parseSquadsTransaction(payload: HeliusWebhookPayload): GovernanceEvent | null {
  const hasSquadsInstruction = payload.instructions.some(
    (instruction) => instruction.programId === SQUADS_PROGRAM_ID,
  );

  if (!hasSquadsInstruction) return null;

  const eventType = detectSquadsEventType(payload);
  if (!eventType) return null;

  return {
    type: eventType,
    protocolAddress: readProtocolAddress(payload),
    sourceProgram: "squads",
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

function detectSquadsEventType(payload: HeliusWebhookPayload): GovernanceEventType | null {
  const text = `${payload.type} ${payload.description} ${JSON.stringify(payload.events)}`;

  if (textIncludesAny(text, ["threshold", "quorum"]) && textIncludesAny(text, ["lower", "reduced", "changed", "2/5", "2 of 5"])) {
    return "MULTISIG_THRESHOLD_CHANGED";
  }

  if (textIncludesAny(text, ["timelock", "time lock"]) && textIncludesAny(text, ["removed", "zero", "0", "changed"])) {
    return "TIMELOCK_CHANGED";
  }

  if (textIncludesAny(text, ["emergency"]) && textIncludesAny(text, ["used", "executed", "bypass"])) {
    return "EMERGENCY_KEY_USED";
  }

  if (textIncludesAny(text, ["signer", "member", "owner"]) && textIncludesAny(text, ["added", "add"])) {
    return "SIGNER_ADDED";
  }

  if (textIncludesAny(text, ["signer", "member", "owner"]) && textIncludesAny(text, ["removed", "remove"])) {
    return "SIGNER_REMOVED";
  }

  return null;
}

