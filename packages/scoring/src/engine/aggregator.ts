import { activeFlagNames } from "../flags.js";
import { logError, logInfo } from "../logger.js";
import { deriveRiskLevel } from "../risk-level.js";
import {
  addHistoryEntry,
  getProtocol,
  hasProtocol,
  initProtocol,
  updateProtocol,
} from "../store.js";
import type { LayerResult, ScoringContext, ScoringResult } from "../types.js";
import { runLayer1 } from "./layer1.js";
import { runLayer2 } from "./layer2.js";
import { runLayer3 } from "./layer3.js";
import { submitScoreUpdate } from "../on-chain.js";

const ON_CHAIN_DELTA_THRESHOLD = 5;

/**
 * Fila por protocolo: garante que múltiplos eventos do mesmo protocolo são
 * processados sequencialmente (evita race conditions ao ler/escrever o store).
 * Eventos de protocolos diferentes continuam sendo processados em paralelo.
 */
const protocolQueues = new Map<string, Promise<unknown>>();

/**
 * Pipeline central:
 *
 * 1. Garante que o protocolo existe no store (auto-bootstrap com score inicial)
 * 2. L1 síncrona (depende só do evento + estado anterior)
 * 3. L2 e L3 em paralelo (I/O bound)
 * 4. Combina deduções e flags
 * 5. Atualiza store + histórico (sempre)
 * 6. Se |Δ| ≥ 5 → submete on-chain via on-chain.ts
 *
 * Eventos do mesmo protocolo são serializados via fila in-memory.
 */
export async function recalculateScore(ctx: ScoringContext): Promise<ScoringResult> {
  const previous = protocolQueues.get(ctx.protocolAddress) ?? Promise.resolve();
  const next = previous.then(() => doRecalculate(ctx)).catch((error) => {
    logError("recalculate_failed", error, { protocol_address: ctx.protocolAddress });
    throw error;
  });
  // Mantém a fila ativa mas não estoura caso a Promise rejeite
  protocolQueues.set(
    ctx.protocolAddress,
    next.catch(() => undefined),
  );
  return next;
}

async function doRecalculate(ctx: ScoringContext): Promise<ScoringResult> {
  const now = Date.now();
  const initialScore = parseInitialScore();

  if (!hasProtocol(ctx.protocolAddress)) {
    initProtocol(ctx.protocolAddress, initialScore, now);
    logInfo("protocol_bootstrapped", {
      protocol_address: ctx.protocolAddress,
      initial_score: initialScore,
    });
  }
  const previous = getProtocol(ctx.protocolAddress)!;

  // ---- L1 (síncrona) ----
  const l1 = runLayer1({ event: ctx.event, current: previous, now });

  // ---- L2 (paralela com preparação para L3) ----
  const l2 = await runLayer2(ctx.protocolAddress).catch((error) => emptyLayerOnError("l2", error));

  // ---- L3 recebe flags combinadas L1+L2 para melhor contexto de risco ----
  const combinedFlagsForL3 = applyFlagDelta(previous.riskFlags, l1, l2, { flagsSet: 0n, flagsClear: 0n, deduction: 0, alerts: [], status: "Healthy" });
  const l3 = await runLayer3({
    protocolAddress: ctx.protocolAddress,
    event: ctx.event,
    combinedFlags: combinedFlagsForL3,
  }).catch((error) => emptyLayerOnError("l3", error));

  // ---- Combina ----
  const totalDeduction = l1.deduction + l2.deduction + l3.deduction;
  const newScore = clamp(100 + totalDeduction, 0, 100);
  const newFlags = applyFlagDelta(previous.riskFlags, l1, l2, l3);
  const riskLevel = deriveRiskLevel(newScore);
  const delta = newScore - previous.trustScore;

  // ---- Atualiza timestamps de flags recém-ativadas ----
  const newFlagTimestamps = { ...previous.flagTimestamps };
  for (const flagName of activeFlagNames(newFlags & ~previous.riskFlags)) {
    newFlagTimestamps[flagName] = now;
  }
  // Always refresh emergency key timestamp when it was used in this event
  if (l1.emergencyKeyLastUsed !== undefined) {
    newFlagTimestamps["FLAG_EMERGENCY_KEY_USED"] = l1.emergencyKeyLastUsed;
  }

  // ---- Persiste histórico off-chain (sempre) ----
  const reason = buildReasonString(l1, l2, l3);
  addHistoryEntry(ctx.protocolAddress, {
    timestamp: now,
    score: newScore,
    reason,
  });

  updateProtocol(ctx.protocolAddress, {
    trustScore: newScore,
    riskFlags: newFlags,
    riskLevel,
    lastUpdate: now,
    flagTimestamps: newFlagTimestamps,
  });

  // ---- On-chain (apenas se |Δ| ≥ 5) ----
  let persistedOnChain = false;
  let txSignature: string | undefined;

  if (Math.abs(delta) >= ON_CHAIN_DELTA_THRESHOLD) {
    try {
      const sig = await submitScoreUpdate({
        protocolAddress: ctx.protocolAddress,
        newScore,
        newRiskFlags: newFlags,
      });
      if (sig) {
        persistedOnChain = true;
        txSignature = sig;
        logInfo("on_chain_update_submitted", {
          protocol_address: ctx.protocolAddress,
          new_score: newScore,
          delta,
          tx_signature: sig,
        });
      }
    } catch (error) {
      logError("on_chain_update_failed", error, {
        protocol_address: ctx.protocolAddress,
        new_score: newScore,
        delta,
      });
    }
  } else {
    logInfo("on_chain_update_skipped", {
      protocol_address: ctx.protocolAddress,
      delta,
      threshold: ON_CHAIN_DELTA_THRESHOLD,
    });
  }

  return {
    protocolAddress: ctx.protocolAddress,
    newScore,
    newFlags,
    riskLevel,
    layers: { l1, l2, l3 },
    delta,
    persistedOnChain,
    txSignature,
  };
}

function applyFlagDelta(
  previous: bigint,
  l1: LayerResult,
  l2: LayerResult,
  l3: LayerResult,
): bigint {
  // L1 já controla a persistência das próprias flags (a sua flagsSet representa o estado completo L1).
  // L2 e L3 são stateless por chamada — combinamos com OR/AND.
  let next = previous;

  // L1: troca completa para os bits L1
  next = (next & ~(l1.flagsSet | l1.flagsClear)) | l1.flagsSet;

  // L2: aplica set/clear
  next = (next | l2.flagsSet) & ~l2.flagsClear;

  // L3: aplica set/clear
  next = (next | l3.flagsSet) & ~l3.flagsClear;

  return next;
}

function buildReasonString(l1: LayerResult, l2: LayerResult, l3: LayerResult): string {
  const parts: string[] = [];
  for (const layer of [l1, l2, l3]) {
    for (const alert of layer.alerts) {
      parts.push(`${alert.flag}: ${alert.message}`);
    }
  }
  return parts.length > 0 ? parts.join(" | ") : "No new risk signals detected";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function emptyLayerOnError(layerName: string, error: unknown): LayerResult {
  logError(`${layerName}_failed`, error);
  return { deduction: 0, flagsSet: 0n, flagsClear: 0n, alerts: [], status: "Healthy" };
}

function parseInitialScore(): number {
  const raw = Number(process.env.DEFAULT_INITIAL_SCORE);
  if (Number.isFinite(raw) && raw >= 0 && raw <= 100) return Math.floor(raw);
  return 85;
}
