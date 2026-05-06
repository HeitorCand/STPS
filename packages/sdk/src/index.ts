import type {
  FlagName,
  ProtocolListResponse,
  RiskLevel,
  ScoreHistoryEntry,
  StpsApiError as StpsApiErrorType,
  StpsClientOptions,
  TrustScoreResponse,
} from "./types.js";

export { StpsApiError } from "./types.js";
export type {
  FlagName,
  LayerStatus,
  ProtocolListResponse,
  RiskLevel,
  ScoreHistoryEntry,
  StpsClientOptions,
  TrustScoreResponse,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_API_URL = "http://localhost:3001";
const DEFAULT_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// StpsClient
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client for the STPS (Solana Trust Protocol Standard) Scoring Engine.
 *
 * @example
 * ```typescript
 * import { StpsClient } from "@stps/sdk";
 *
 * const client = new StpsClient({ apiUrl: "https://stps-scoring.fly.dev" });
 *
 * const score = await client.getScore("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
 * console.log(score.currentScore);  // 42
 * console.log(score.riskLevel);     // "Critical"
 * console.log(score.activeFlags);   // ["FLAG_TIMELOCK_REMOVED", "FLAG_MULTISIG_THRESHOLD_LOWERED"]
 * ```
 */
export class StpsClient {
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: StpsClientOptions = {}) {
    this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  // ── Core request helper ────────────────────────────────────────────────────

  private async request<T>(path: string): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    let response: Response;

    try {
      response = await fetchWithTimeout(this.fetchFn, url, this.timeoutMs);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`STPS SDK: network error fetching ${url} — ${msg}`);
    }

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const { StpsApiError } = await import("./types.js");
      throw new StpsApiError(
        response.status,
        body,
        `STPS API returned ${response.status} for ${path}`,
      ) as StpsApiErrorType;
    }

    return body as T;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Fetch the current trust score for a single protocol.
   *
   * @param protocolAddress - The protocol's Solana public key (base58).
   * @throws {StpsApiError} If the protocol is not found (404) or request fails.
   *
   * @example
   * ```typescript
   * const score = await client.getScore("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
   * if (score.riskLevel === "Critical") {
   *   console.warn("⚠️ Protocol at critical risk!");
   * }
   * ```
   */
  async getScore(protocolAddress: string): Promise<TrustScoreResponse> {
    return this.request<TrustScoreResponse>(`/api/score/${encodeURIComponent(protocolAddress)}`);
  }

  /**
   * Fetch the full score history for a protocol.
   * Returns the `history` array from the score response.
   *
   * @param protocolAddress - The protocol's Solana public key (base58).
   *
   * @example
   * ```typescript
   * const history = await client.getHistory("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
   * // history = [{ timestamp, score, reason }, ...]
   * ```
   */
  async getHistory(protocolAddress: string): Promise<ScoreHistoryEntry[]> {
    const response = await this.getScore(protocolAddress);
    return response.history;
  }

  /**
   * Fetch all tracked protocols and their current scores.
   *
   * @example
   * ```typescript
   * const { protocols } = await client.getProtocols();
   * protocols.forEach(p => console.log(p.protocolAddress, p.currentScore));
   * ```
   */
  async getProtocols(): Promise<ProtocolListResponse> {
    return this.request<ProtocolListResponse>("/api/protocols");
  }

  /**
   * Check if the Scoring Engine is reachable.
   *
   * @returns `true` if the health endpoint responds with `{ status: "ok" }`.
   *
   * @example
   * ```typescript
   * const ok = await client.isHealthy();
   * if (!ok) console.error("Scoring Engine is down");
   * ```
   */
  async isHealthy(): Promise<boolean> {
    try {
      const body = await this.request<{ status: string }>("/health");
      return body.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Subscribe to score changes for a protocol using polling.
   *
   * Calls `onUpdate` every `intervalMs` milliseconds when the score changes.
   * Returns a `stop` function to cancel the subscription.
   *
   * @param protocolAddress - The protocol to watch.
   * @param onUpdate - Called with the new score whenever it changes.
   * @param options.intervalMs - Polling interval. Default: 5000ms.
   * @param options.onError - Optional error handler. Default: logs to console.
   *
   * @example
   * ```typescript
   * const stop = client.subscribeToAlerts("dRiftyHA39...", (score) => {
   *   console.log("New score:", score.currentScore, score.riskLevel);
   * });
   *
   * // Later:
   * stop();
   * ```
   */
  subscribeToAlerts(
    protocolAddress: string,
    onUpdate: (score: TrustScoreResponse) => void,
    options: {
      intervalMs?: number;
      onError?: (error: Error) => void;
    } = {},
  ): () => void {
    const intervalMs = options.intervalMs ?? 5_000;
    const onError =
      options.onError ??
      ((err: Error) => console.error("[StpsClient] subscribeToAlerts error:", err.message));

    let lastScore: number | null = null;
    let lastFlags: string | null = null;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        const score = await this.getScore(protocolAddress);
        const flagsKey = score.activeFlags.slice().sort().join(",");

        if (score.currentScore !== lastScore || flagsKey !== lastFlags) {
          lastScore = score.currentScore;
          lastFlags = flagsKey;
          onUpdate(score);
        }
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    // Run immediately then on interval
    void poll();
    const timer = setInterval(() => void poll(), intervalMs);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }
}
