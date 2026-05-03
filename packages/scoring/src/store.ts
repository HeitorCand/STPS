import { deriveRiskLevel } from "./risk-level.js";
import type { HistoryEntry, ProtocolState } from "./types.js";

/**
 * Store in-memory de estados por protocolo.
 *
 * MVP sem banco de dados: o on-chain PDA é a fonte de verdade verificável;
 * este Map é cache + histórico off-chain para o gráfico do frontend.
 *
 * Em produção: substituir por PostgreSQL/Redis.
 */

const protocols = new Map<string, ProtocolState>();

const MAX_HISTORY_ENTRIES = 500;

export function getProtocol(protocolAddress: string): ProtocolState | undefined {
  return protocols.get(protocolAddress);
}

export function listProtocols(): ProtocolState[] {
  return Array.from(protocols.values());
}

export function hasProtocol(protocolAddress: string): boolean {
  return protocols.has(protocolAddress);
}

export function initProtocol(protocolAddress: string, initialScore: number, timestamp: number): ProtocolState {
  const state: ProtocolState = {
    protocolAddress,
    trustScore: initialScore,
    riskFlags: 0n,
    riskLevel: deriveRiskLevel(initialScore),
    lastUpdate: timestamp,
    history: [
      {
        timestamp,
        score: initialScore,
        reason: "Baseline — protocol registered",
      },
    ],
    flagTimestamps: {},
  };
  protocols.set(protocolAddress, state);
  return state;
}

export function updateProtocol(
  protocolAddress: string,
  patch: Partial<Pick<ProtocolState, "trustScore" | "riskFlags" | "riskLevel" | "lastUpdate" | "flagTimestamps">>,
): ProtocolState {
  const current = protocols.get(protocolAddress);
  if (!current) {
    throw new Error(`Protocol not initialized: ${protocolAddress}`);
  }
  const next: ProtocolState = { ...current, ...patch };
  protocols.set(protocolAddress, next);
  return next;
}

/** Limpa todo o store. Útil para testes. */
export function resetStore(): void {
  protocols.clear();
}

export function addHistoryEntry(protocolAddress: string, entry: HistoryEntry): void {
  const current = protocols.get(protocolAddress);
  if (!current) return;
  current.history.push(entry);
  if (current.history.length > MAX_HISTORY_ENTRIES) {
    current.history.splice(0, current.history.length - MAX_HISTORY_ENTRIES);
  }
}
