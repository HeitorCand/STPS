import type {
  FlagName,
  MonitoredProtocol,
  ProtocolListResponse,
  RiskLevel,
  ScoreHistoryEntry,
  StpsApiError as StpsApiErrorType,
  StpsClientOptions,
  StpsProfileResponse,
  TrustScoreResponse,
} from "./types.js";

export { StpsApiError } from "./types.js";
export type {
  ClaimedProtocol,
  ClaimStatus,
  FlagName,
  MonitoredProtocol,
  ProtocolListResponse,
  RiskLevel,
  ScoreHistoryEntry,
  StpsClientOptions,
  StpsProfileResponse,
  TrustScoreResponse,
  VerificationMethod,
} from "./types.js";

const DEFAULT_API_URL = "https://stps-scoring-production.up.railway.app";
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

/**
 * Authenticated client for the STPS Scoring Engine.
 *
 * This client reads only the protocols bound to the current STPS account.
 *
 * @example
 * ```typescript
 * import { StpsClient } from "stps-sdk";
 *
 * const client = new StpsClient({
 *   token: process.env.STPS_API_TOKEN!,
 * });
 *
 * const { protocols } = await client.getProtocols();
 * console.log(protocols.map((item) => item.protocolAddress));
 * ```
 */
export class StpsClient {
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly token: string;

  constructor(options: StpsClientOptions) {
    if (!options?.token?.trim()) {
      throw new Error("STPS SDK: token is required");
    }

    this.apiUrl = (options.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.token = options.token;
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    let response: Response;

    try {
      response = await fetchWithTimeout(this.fetchFn, url, this.timeoutMs, {
        headers: {
          "X-STPS-Token": this.token,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`STPS SDK: network error fetching ${url} - ${msg}`);
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

  /**
   * Fetch the authenticated STPS profile tied to the current token.
   */
  async getProfile(): Promise<StpsProfileResponse> {
    return this.request<StpsProfileResponse>("/api/me");
  }

  /**
   * Fetch all protocols monitored by the authenticated account.
   */
  async getProtocols(): Promise<ProtocolListResponse> {
    return this.request<ProtocolListResponse>("/api/me/protocols");
  }

  /**
   * Fetch one monitored protocol by protocol address.
   *
   * Throws `StpsApiError(404)` when the protocol is not attached to the current account.
   */
  async getProtocol(protocolAddress: string): Promise<MonitoredProtocol> {
    const { protocols } = await this.getProtocols();
    const monitored = protocols.find((item) => item.protocolAddress === protocolAddress);

    if (!monitored) {
      const { StpsApiError } = await import("./types.js");
      throw new StpsApiError(
        404,
        { status: "not_found", protocolAddress },
        `STPS API returned 404 for monitored protocol ${protocolAddress}`,
      ) as StpsApiErrorType;
    }

    return monitored;
  }

  /**
   * Fetch the current trust score for a protocol already monitored by the authenticated account.
   */
  async getScore(protocolAddress: string): Promise<TrustScoreResponse> {
    const monitored = await this.getProtocol(protocolAddress);
    return monitored.protocol;
  }

  /**
   * Fetch the full score history for a monitored protocol.
   */
  async getHistory(protocolAddress: string): Promise<ScoreHistoryEntry[]> {
    const score = await this.getScore(protocolAddress);
    return score.history;
  }

  /**
   * Check if the Scoring Engine is reachable.
   *
   * Uses the authenticated `/api/me` route to ensure both API availability and token validity.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const body = await this.getProfile();
      return body.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Subscribe to score changes for a monitored protocol using polling.
   *
   * Calls `onUpdate` whenever the score or active flags change.
   */
  subscribeToAlerts(
    protocolAddress: string,
    onUpdate: (protocol: MonitoredProtocol) => void,
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
        const protocol = await this.getProtocol(protocolAddress);
        const flagsKey = protocol.protocol.activeFlags
          .slice()
          .sort()
          .join(",") as string;

        if (
          protocol.protocol.currentScore !== lastScore ||
          flagsKey !== lastFlags
        ) {
          lastScore = protocol.protocol.currentScore;
          lastFlags = flagsKey;
          onUpdate(protocol);
        }
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), intervalMs);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }
}
