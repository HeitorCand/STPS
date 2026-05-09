// ─────────────────────────────────────────────────────────────────────────────
// stps-sdk — Public types
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
  | "FLAG_UNKNOWN_SIGNER_ADDED"
  | "FLAG_EMERGENCY_KEY_USED"
  | "FLAG_WASH_TRADING"
  | "FLAG_LOW_LIQUIDITY_COLLATERAL"
  | "FLAG_NEW_TOKEN_COLLATERAL"
  | "FLAG_HIGH_HOLDER_CONCENTRATION"
  | "FLAG_PENDING_ADMIN_NONCE"
  | "FLAG_MULTIPLE_ADMIN_NONCES";

/** Wallet verification result attached to a claimed protocol. */
export type VerificationMethod = "upgrade_authority" | "known_admin_signer" | null;

/** Claim status inside the private STPS workspace. */
export type ClaimStatus = "claimed" | "verified" | "manual_review";

/** Score state for one protocol inside the authenticated workspace. */
export interface TrustScoreResponse {
  protocolAddress: string;
  currentScore: number;
  riskLevel: RiskLevel;
  activeFlags: FlagName[];
  riskFlagsBitmask: string;
  lastUpdate: number;
  history: ScoreHistoryEntry[];
}

/** Claim metadata returned by the authenticated workspace routes. */
export interface ClaimedProtocol {
  id: string;
  label: string | null;
  protocolAddress: string;
  claimedByWallet: string;
  status: ClaimStatus;
  verificationMethod: VerificationMethod;
  verificationTarget: string | null;
  verificationNotes: string | null;
  registrationTxSignature: string | null;
  createdAt: string;
  updatedAt: string;
  protocol: TrustScoreResponse;
}

/** Authenticated list of protocols bound to the current STPS account. */
export interface ProtocolListResponse {
  status: "ok";
  count: number;
  protocols: ClaimedProtocol[];
}

/** Session user returned by `/api/me`. */
export interface StpsSessionUser {
  id: string;
  primaryWalletAddress: string;
}

/** Session metadata returned by `/api/me`. */
export interface StpsSessionInfo {
  id: string;
  walletAddress: string;
  expiresAt: string;
}

/** Persistent API token metadata when the profile is loaded via SDK token auth. */
export interface StpsApiTokenInfo {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Authenticated profile payload returned by `/api/me`. */
export interface StpsProfileResponse {
  status: "ok";
  user: StpsSessionUser;
  session: StpsSessionInfo | null;
  apiToken: StpsApiTokenInfo | null;
}

/** Options for constructing an authenticated STPS client. */
export interface StpsClientOptions {
  /**
   * Persistent API token issued by the STPS dashboard/account workspace.
   */
  token: string;

  /**
   * Base URL of the STPS Scoring Engine.
   * @example "https://stps-scoring-production.up.railway.app"
   * @default official STPS deployment
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
