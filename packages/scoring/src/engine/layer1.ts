import {
  FLAG_EMERGENCY_KEY_USED,
  FLAG_MULTISIG_THRESHOLD_LOWERED,
  FLAG_TIMELOCK_REMOVED,
  FLAG_UNKNOWN_SIGNER_ADDED,
  L1_FLAGS_MASK,
} from "../flags.js";
import type { GovernanceEvent, LayerResult, ProtocolState } from "../types.js";

/**
 * Layer 1 — Governance Intelligence
 *
 * Mapeia o `GovernanceEvent` recebido do Indexer numa dedução + flag.
 *
 * Comportamento das flags:
 * - Persistentes: uma flag ativa continua descontando até ser revertida.
 *   Reversões são detectadas quando o evento "oposto" chega (ex: timelock restaurado).
 * - Exceção: FLAG_EMERGENCY_KEY_USED expira automaticamente após 72h sem nova ocorrência.
 *
 * Esta camada é síncrona — não faz I/O.
 */

const EMERGENCY_KEY_TTL_MS = 72 * 60 * 60 * 1000; // 72h

interface LayerOneInput {
  event: GovernanceEvent;
  current: ProtocolState | null;
  now: number;
}

export function runLayer1({ event, current, now }: LayerOneInput): LayerResult {
  const result: LayerResult = {
    deduction: 0,
    flagsSet: 0n,
    flagsClear: 0n,
    alerts: [],
    status: "Healthy",
  };

  switch (event.type) {
    case "TIMELOCK_CHANGED": {
      const newDuration = readNumber(event.metadata, ["newDuration", "newTimelock", "timelock"]);
      if (newDuration === 0 || newDuration === null) {
        result.flagsSet |= FLAG_TIMELOCK_REMOVED;
        result.alerts.push({
          flag: "FLAG_TIMELOCK_REMOVED",
          message: "Timelock removido ou zerado em transação de governança",
        });
      } else if (newDuration > 0) {
        result.flagsClear |= FLAG_TIMELOCK_REMOVED;
      }
      break;
    }

    case "MULTISIG_THRESHOLD_CHANGED": {
      const oldThreshold = readNumber(event.metadata, ["oldThreshold", "previousThreshold"]);
      const newThreshold = readNumber(event.metadata, ["newThreshold", "threshold"]);
      if (oldThreshold !== null && newThreshold !== null && newThreshold < oldThreshold) {
        result.flagsSet |= FLAG_MULTISIG_THRESHOLD_LOWERED;
        result.alerts.push({
          flag: "FLAG_MULTISIG_THRESHOLD_LOWERED",
          message: `Threshold do multisig reduzido (${oldThreshold} → ${newThreshold})`,
        });
      } else if (oldThreshold === null && newThreshold === null) {
        // Indexer não conseguiu extrair os valores: assumir reducao (conservador para hackathon).
        result.flagsSet |= FLAG_MULTISIG_THRESHOLD_LOWERED;
        result.alerts.push({
          flag: "FLAG_MULTISIG_THRESHOLD_LOWERED",
          message: "Threshold do multisig alterado — valores não disponíveis no payload",
        });
      } else if (oldThreshold !== null && newThreshold !== null && newThreshold > oldThreshold) {
        result.flagsClear |= FLAG_MULTISIG_THRESHOLD_LOWERED;
      }
      break;
    }

    case "SIGNER_ADDED": {
      result.flagsSet |= FLAG_UNKNOWN_SIGNER_ADDED;
      result.alerts.push({
        flag: "FLAG_UNKNOWN_SIGNER_ADDED",
        message: "Novo signatário adicionado ao multisig",
      });
      break;
    }

    case "SIGNER_REMOVED": {
      // NOTE: We only clear the flag if the event metadata explicitly says
      // all unknown signers are gone (e.g., confirmedClean=true). Otherwise
      // we conservatively keep the flag — one removal doesn't mean all
      // unknown signers have been removed.
      const confirmedClean = event.metadata?.confirmedClean === true ||
        event.metadata?.remainingUnknownSigners === 0;
      if (confirmedClean) {
        result.flagsClear |= FLAG_UNKNOWN_SIGNER_ADDED;
      }
      break;
    }

    case "EMERGENCY_KEY_USED": {
      result.flagsSet |= FLAG_EMERGENCY_KEY_USED;
      // Mark timestamp so TTL always resets from the most recent use
      result.emergencyKeyLastUsed = now;
      result.alerts.push({
        flag: "FLAG_EMERGENCY_KEY_USED",
        message: "Chave de emergência usada sem timelock",
      });
      break;
    }

    case "NONCE_ACCOUNT_CREATED":
    case "NONCE_ADVANCED": {
      // Eventos de nonce são tratados pela L3, não pela L1.
      break;
    }
  }

  // Combinação de flags persistentes + novas:
  // - Carregamos as flags atuais
  // - Removemos as flagsClear
  // - Aplicamos expiração natural (FLAG_EMERGENCY_KEY_USED depois de 72h)
  let activeFlags = current?.riskFlags ?? 0n;
  activeFlags &= ~result.flagsClear;

  if (current && (activeFlags & FLAG_EMERGENCY_KEY_USED) !== 0n) {
    const lastSeen = current.flagTimestamps.FLAG_EMERGENCY_KEY_USED ?? 0;
    if (now - lastSeen > EMERGENCY_KEY_TTL_MS) {
      activeFlags &= ~FLAG_EMERGENCY_KEY_USED;
    }
  }

  activeFlags |= result.flagsSet;

  // Calcula a dedução total considerando todas as flags L1 ativas.
  result.deduction = computeL1Deduction(activeFlags);
  // Flags L1 que devem permanecer (já filtradas e expiradas).
  result.flagsSet = activeFlags & L1_FLAGS_MASK;

  if (result.deduction <= -45) {
    result.status = "Critical";
  } else if (result.deduction < 0) {
    result.status = "Warning";
  }

  return result;
}

function computeL1Deduction(flags: bigint): number {
  let total = 0;
  if ((flags & FLAG_TIMELOCK_REMOVED) !== 0n) total -= 30;
  if ((flags & FLAG_MULTISIG_THRESHOLD_LOWERED) !== 0n) total -= 20;
  if ((flags & FLAG_UNKNOWN_SIGNER_ADDED) !== 0n) total -= 15;
  if ((flags & FLAG_EMERGENCY_KEY_USED) !== 0n) total -= 25;
  return total;
}

function readNumber(metadata: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}
