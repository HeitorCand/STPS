import type { GovernanceEvent, GovernanceEventType, HeliusWebhookPayload } from "../types.js";
import { SPL_GOVERNANCE_PROGRAM_ID } from "../constants.js";
import { collectInstructionAccounts, readProtocolAddress, textIncludesAny } from "./helpers.js";

export function parseSplGovernanceTransaction(payload: HeliusWebhookPayload): GovernanceEvent | null {
  const hasGovernanceInstruction = payload.instructions.some(
    (instruction) => instruction.programId === SPL_GOVERNANCE_PROGRAM_ID,
  );

  if (!hasGovernanceInstruction) return null;

  const eventType = detectSplGovernanceEventType(payload);
  if (!eventType) return null;

  return {
    type: eventType,
    protocolAddress: readProtocolAddress(payload),
    sourceProgram: "spl-governance",
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

function detectSplGovernanceEventType(payload: HeliusWebhookPayload): GovernanceEventType | null {
  const text = `${payload.type} ${payload.description} ${JSON.stringify(payload.events)}`;

  if (textIncludesAny(text, ["timelock", "voting period", "execution delay"]) && textIncludesAny(text, ["removed", "zero", "0", "changed"])) {
    return "TIMELOCK_CHANGED";
  }

  if (textIncludesAny(text, ["emergency"]) && textIncludesAny(text, ["executed", "used", "bypass"])) {
    return "EMERGENCY_KEY_USED";
  }

  if (textIncludesAny(text, ["threshold", "quorum", "vote threshold"]) && textIncludesAny(text, ["lower", "reduced", "changed"])) {
    return "MULTISIG_THRESHOLD_CHANGED";
  }

  return null;
}

