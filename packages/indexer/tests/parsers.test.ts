import { describe, expect, it } from "vitest";
import { DRIFT_PROTOCOL_ADDRESS, SPL_GOVERNANCE_PROGRAM_ID, SQUADS_PROGRAM_ID, SYSTEM_PROGRAM_ID } from "../src/constants.js";
import { parseNonceTransaction } from "../src/parsers/nonce.js";
import { parseSplGovernanceTransaction } from "../src/parsers/spl-governance.js";
import { parseSquadsTransaction } from "../src/parsers/squads.js";
import type { HeliusWebhookPayload } from "../src/types.js";

function basePayload(overrides: Partial<HeliusWebhookPayload>): HeliusWebhookPayload {
  return {
    accountData: [{ account: DRIFT_PROTOCOL_ADDRESS, nativeBalanceChange: 0 }],
    description: "",
    events: {},
    fee: 5000,
    feePayer: "FeePayer111111111111111111111111111111111",
    instructions: [],
    signature: "test-signature",
    timestamp: 1711540000,
    type: "UNKNOWN",
    ...overrides,
  };
}

describe("parseSquadsTransaction", () => {
  it("detects multisig threshold changes", () => {
    const payload = basePayload({
      description: "Squads multisig threshold changed from 3/5 to 2/5",
      instructions: [
        {
          accounts: [DRIFT_PROTOCOL_ADDRESS],
          data: "threshold-change",
          innerInstructions: [],
          programId: SQUADS_PROGRAM_ID,
        },
      ],
    });

    const event = parseSquadsTransaction(payload);

    expect(event).toMatchObject({
      type: "MULTISIG_THRESHOLD_CHANGED",
      protocolAddress: DRIFT_PROTOCOL_ADDRESS,
      sourceProgram: "squads",
      rawSignature: "test-signature",
    });
  });

  it("returns null for unrelated programs", () => {
    const payload = basePayload({
      description: "threshold changed",
      instructions: [
        {
          accounts: [DRIFT_PROTOCOL_ADDRESS],
          data: "",
          innerInstructions: [],
          programId: SYSTEM_PROGRAM_ID,
        },
      ],
    });

    expect(parseSquadsTransaction(payload)).toBeNull();
  });
});

describe("parseSplGovernanceTransaction", () => {
  it("detects timelock changes", () => {
    const payload = basePayload({
      description: "Governance execution delay timelock changed to 0",
      instructions: [
        {
          accounts: [DRIFT_PROTOCOL_ADDRESS],
          data: "set-governance-config",
          innerInstructions: [],
          programId: SPL_GOVERNANCE_PROGRAM_ID,
        },
      ],
    });

    const event = parseSplGovernanceTransaction(payload);

    expect(event).toMatchObject({
      type: "TIMELOCK_CHANGED",
      sourceProgram: "spl-governance",
      protocolAddress: DRIFT_PROTOCOL_ADDRESS,
    });
  });
});

describe("parseNonceTransaction", () => {
  it("detects nonce advance events", () => {
    const payload = basePayload({
      description: "System Program advance nonce for admin key",
      instructions: [
        {
          accounts: [DRIFT_PROTOCOL_ADDRESS, "Nonce1111111111111111111111111111111111"],
          data: "advanceNonce",
          innerInstructions: [],
          programId: SYSTEM_PROGRAM_ID,
        },
      ],
    });

    const event = parseNonceTransaction(payload);

    expect(event).toMatchObject({
      type: "NONCE_ADVANCED",
      sourceProgram: "system-nonce",
      protocolAddress: DRIFT_PROTOCOL_ADDRESS,
    });
  });

  it("detects nonce account creation events", () => {
    const payload = basePayload({
      description: "System Program initialize nonce account created",
      instructions: [
        {
          accounts: [DRIFT_PROTOCOL_ADDRESS, "Nonce2222222222222222222222222222222222"],
          data: "initializeNonce",
          innerInstructions: [],
          programId: SYSTEM_PROGRAM_ID,
        },
      ],
    });

    const event = parseNonceTransaction(payload);

    expect(event?.type).toBe("NONCE_ACCOUNT_CREATED");
  });
});

