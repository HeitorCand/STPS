import type { RiskLevel } from "./risk-level.js";
import type { FlagName } from "./flags.js";

// ----------------------------------------------------------------------------
// GovernanceEvent — espelha packages/indexer/src/types.ts
// Mantemos a definição duplicada para evitar dependência cruzada entre pacotes
// (o indexer e o scoring são serviços HTTP independentes).
// ----------------------------------------------------------------------------

export type GovernanceEventType =
  | "MULTISIG_THRESHOLD_CHANGED"
  | "TIMELOCK_CHANGED"
  | "SIGNER_ADDED"
  | "SIGNER_REMOVED"
  | "EMERGENCY_KEY_USED"
  | "NONCE_ACCOUNT_CREATED"
  | "NONCE_ADVANCED";

export type GovernanceSourceProgram = "squads" | "spl-governance" | "system-nonce";

export interface GovernanceEvent {
  type: GovernanceEventType;
  protocolAddress: string;
  sourceProgram: GovernanceSourceProgram;
  rawSignature: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Resultado de cada camada
// ----------------------------------------------------------------------------

export interface LayerAlert {
  flag: FlagName;
  message: string;
}

export interface LayerResult {
  /** Dedução negativa (ex: -20). 0 quando a camada não detecta nada. */
  deduction: number;
  /** Bitmask das flags que esta camada quer ativar neste cálculo. */
  flagsSet: bigint;
  /** Bitmask das flags que esta camada quer desativar (ex: timelock restaurado). */
  flagsClear: bigint;
  /** Alertas legíveis para humanos (usados na resposta da API). */
  alerts: LayerAlert[];
  /** Status sumário para a API REST. */
  status: "Healthy" | "Warning" | "Critical";
}

// ----------------------------------------------------------------------------
// Estado persistido (in-memory) por protocolo
// ----------------------------------------------------------------------------

export interface HistoryEntry {
  timestamp: number;
  score: number;
  reason: string;
}

export interface FlagTimestamps {
  /** Quando cada flag foi ativada pela última vez (para expiração temporal). */
  [flagName: string]: number | undefined;
}

export interface ProtocolState {
  protocolAddress: string;
  trustScore: number;
  riskFlags: bigint;
  riskLevel: RiskLevel;
  lastUpdate: number;
  history: HistoryEntry[];
  flagTimestamps: FlagTimestamps;
}

// ----------------------------------------------------------------------------
// Contexto e resultado do aggregator
// ----------------------------------------------------------------------------

export interface ScoringContext {
  protocolAddress: string;
  event: GovernanceEvent;
}

export interface ScoringResult {
  protocolAddress: string;
  newScore: number;
  newFlags: bigint;
  riskLevel: RiskLevel;
  layers: {
    l1: LayerResult;
    l2: LayerResult;
    l3: LayerResult;
  };
  delta: number;
  persistedOnChain: boolean;
  txSignature?: string;
}
