// ─────────────────────────────────────────────────────────────────────────────
// @stps/sdk — Public types
// ─────────────────────────────────────────────────────────────────────────────

/** Risk level assigned to a protocol based on its trust score. */
export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

/** A single point in the protocol's score history. */
export interface ScoreHistoryEntry {
  /** Unix timestamp (ms). */
  timestamp: number;
  /** Trust score at this point (0–100). */
  score: number;
  /** Human-readable reason for the change. */
  reason: string;
}

/** Active risk flag names (correspond to on-chain bitmask bits). */
export type FlagName =
  | "FLAG_TIMELOCK_REMOVED"
  | "FLAG_MULTISIG_THRESHOLD_LOWERED"
  | "FLAG_UNKNOWN_SIGNER"
  | "FLAG_EMERGENCY_KEY_USED"
  | "FLAG_WASH_TRADING"
  | "FLAG_LOW_LIQUIDITY_COLLATERAL"
  | "FLAG_NEW_TOKEN_COLLATERAL"
  | "FLAG_HIGH_HOLDER_CONCENTRATION"
  | "FLAG_PENDING_ADMIN_NONCE";

/** Status summary of a single scoring layer. */
export type LayerStatus = "Healthy" | "Warning" | "Critical";

/** Full trust score response returned by the API / SDK. */
export interface TrustScoreResponse {
  /** Protocol's Solana public key address. */
  protocolAddress: string;
  /** Current trust score (0–100). */
  currentScore: number;
  /** Derived risk level. */
  riskLevel: RiskLevel;
  /** List of currently active risk flag names. */
  activeFlags: FlagName[];
  /** Raw bitmask as a decimal string (for on-chain reconciliation). */
  riskFlagsBitmask: string;
  /** Unix timestamp (ms) of the last score update. */
  lastUpdate: number;
  /** Full scoring history, oldest first. */
  history: ScoreHistoryEntry[];
}

/** Paginated list of all tracked protocols. */
export interface ProtocolListResponse {
  count: number;
  protocols: TrustScoreResponse[];
}

/** Options for constructing an StpsClient. */
export interface StpsClientOptions {
  /**
   * Base URL of the STPS Scoring Engine.
   * @example "https://stps-scoring.fly.dev"
   * @default "http://localhost:3001"
   */
  apiUrl?: string;

  /**
   * Request timeout in milliseconds.
   * @default 10000
   */
  timeoutMs?: number;

  /**
   * Custom fetch implementation (useful for Next.js / edge runtimes).
   * Defaults to the global `fetch`.
   */
  fetchFn?: typeof fetch;
}

/** Error thrown when the STPS API returns a non-2xx response. */
export class StpsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "StpsApiError";
  }
}
