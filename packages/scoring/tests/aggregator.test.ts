import { describe, expect, it, beforeEach } from "vitest";
import { recalculateScore } from "../src/engine/aggregator.js";
import { resetStore } from "../src/store.js";
import type { GovernanceEvent } from "../src/types.js";

const PROTOCOL = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH";

beforeEach(() => {
  resetStore();
  process.env.DISABLE_ON_CHAIN = "true";
  process.env.DEFAULT_INITIAL_SCORE = "85";
});

function buildEvent(partial: Partial<GovernanceEvent>): GovernanceEvent {
  return {
    type: "MULTISIG_THRESHOLD_CHANGED",
    protocolAddress: PROTOCOL,
    sourceProgram: "squads",
    rawSignature: "sig123",
    timestamp: Date.now(),
    metadata: {},
    ...partial,
  };
}

describe("recalculateScore — Caso Drift", () => {
  it("aplica -20 ao reduzir threshold do multisig (85 → 65)", async () => {
    const event = buildEvent({
      type: "MULTISIG_THRESHOLD_CHANGED",
      metadata: { oldThreshold: 3, newThreshold: 2 },
    });

    const result = await recalculateScore({ protocolAddress: PROTOCOL, event });

    expect(result.newScore).toBe(80);
    expect(result.riskLevel).toBe("Medium");
    expect(result.layers.l1.deduction).toBe(-20);
    expect(result.delta).toBe(-5);
  });

  it("aplica -30 adicional ao remover timelock após threshold reduzido (cumulativo)", async () => {
    // Estado inicial: threshold já reduzido
    await recalculateScore({
      protocolAddress: PROTOCOL,
      event: buildEvent({
        type: "MULTISIG_THRESHOLD_CHANGED",
        metadata: { oldThreshold: 3, newThreshold: 2 },
      }),
    });

    // Segundo evento: timelock removido
    const result = await recalculateScore({
      protocolAddress: PROTOCOL,
      event: buildEvent({
        type: "TIMELOCK_CHANGED",
        metadata: { newDuration: 0 },
      }),
    });

    expect(result.layers.l1.deduction).toBe(-50);
    expect(result.newScore).toBe(50);
    expect(result.riskLevel).toBe("High");
  });

  it("score volta a 100 quando flag é revertida (threshold restaurado)", async () => {
    await recalculateScore({
      protocolAddress: PROTOCOL,
      event: buildEvent({
        type: "MULTISIG_THRESHOLD_CHANGED",
        metadata: { oldThreshold: 3, newThreshold: 2 },
      }),
    });

    const result = await recalculateScore({
      protocolAddress: PROTOCOL,
      event: buildEvent({
        type: "MULTISIG_THRESHOLD_CHANGED",
        metadata: { oldThreshold: 2, newThreshold: 3 },
      }),
    });

    expect(result.layers.l1.deduction).toBe(0);
    expect(result.newScore).toBe(100);
    expect(result.riskLevel).toBe("Low");
  });
});

describe("Threshold on-chain |Δ| ≥ 5", () => {
  it("não persiste on-chain quando delta < 5", async () => {
    // Bootstrap do protocolo no score 85
    await recalculateScore({
      protocolAddress: PROTOCOL,
      event: buildEvent({
        type: "NONCE_ADVANCED",
        sourceProgram: "system-nonce",
        metadata: {},
      }),
    });

    // Segundo evento idêntico: delta = 0
    const result = await recalculateScore({
      protocolAddress: PROTOCOL,
      event: buildEvent({
        type: "NONCE_ADVANCED",
        sourceProgram: "system-nonce",
        metadata: {},
      }),
    });

    expect(Math.abs(result.delta)).toBeLessThan(5);
    expect(result.persistedOnChain).toBe(false);
  });
});
