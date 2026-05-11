import { beforeEach, describe, expect, it, vi } from "vitest";
import { StpsApiError, StpsClient } from "../src/index.js";
import type { MonitoredProtocol, ProtocolListResponse, StpsProfileResponse, TrustScoreResponse } from "../src/index.js";

const DRIFT = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH";

const driftScore: TrustScoreResponse = {
  protocolAddress: DRIFT,
  currentScore: 42,
  riskLevel: "Critical",
  activeFlags: ["FLAG_TIMELOCK_REMOVED", "FLAG_MULTISIG_THRESHOLD_LOWERED"],
  riskFlagsBitmask: "3",
  lastUpdate: 1711586400000,
  history: [
    { timestamp: 1711500000000, score: 85, reason: "Baseline" },
    { timestamp: 1711540000000, score: 65, reason: "FLAG_MULTISIG_THRESHOLD_LOWERED" },
    { timestamp: 1711586400000, score: 42, reason: "FLAG_TIMELOCK_REMOVED" },
  ],
};

const profile: StpsProfileResponse = {
  status: "ok",
  user: {
    id: "user-1",
    primaryWalletAddress: "CdfWWvhz28aXF3umJcFU7tSdWyZK3SQkJuwvfesGemxt",
  },
  session: null,
  apiToken: {
    id: "api-token-1",
    label: "SDK token",
    createdAt: "2026-05-09T12:00:00.000Z",
    lastUsedAt: "2026-05-09T12:05:00.000Z",
  },
};

const driftProtocol: MonitoredProtocol = {
  id: "claim-1",
  label: "Drift watchlist",
  protocolAddress: DRIFT,
  claimedByWallet: profile.user.primaryWalletAddress,
  status: "verified",
  verificationMethod: "upgrade_authority",
  verificationTarget: profile.user.primaryWalletAddress,
  verificationNotes: null,
  registrationTxSignature: "sig-1",
  createdAt: "2026-05-09T12:00:00.000Z",
  updatedAt: "2026-05-09T12:05:00.000Z",
  protocol: driftScore,
};

function mockFetch(responses: Record<string, unknown>): typeof fetch {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = new URL(url).pathname;
    const auth = init?.headers && "X-STPS-Token" in (init.headers as Record<string, string>)
      ? (init.headers as Record<string, string>)["X-STPS-Token"]
      : undefined;

    if (!auth?.startsWith("stps_")) {
      return new Response(JSON.stringify({ status: "unauthorized" }), { status: 401 });
    }

    const body = responses[path];
    if (body === undefined) {
      return new Response(JSON.stringify({ status: "not_found" }), { status: 404 });
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("StpsClient", () => {
  let client: StpsClient;

  beforeEach(() => {
    client = new StpsClient({
      token: "stps_test_token",
      apiUrl: "http://localhost:3001",
      fetchFn: mockFetch({
        "/api/me": profile,
        "/api/me/protocols": {
          status: "ok",
          count: 1,
          protocols: [driftProtocol],
        } satisfies ProtocolListResponse,
      }),
    });
  });

  it("getProfile retorna a sessão autenticada", async () => {
    const result = await client.getProfile();

    expect(result.user.primaryWalletAddress).toBe(profile.user.primaryWalletAddress);
    expect(result.apiToken?.id).toBe(profile.apiToken?.id);
  });

  it("getProtocols retorna apenas protocolos do workspace autenticado", async () => {
    const result = await client.getProtocols();

    expect(result.count).toBe(1);
    expect(result.protocols[0].protocolAddress).toBe(DRIFT);
    expect(result.protocols[0].status).toBe("verified");
  });

  it("getProtocol retorna protocolo monitorado individual por address", async () => {
    const result = await client.getProtocol(DRIFT);

    expect(result.id).toBe("claim-1");
    expect(result.protocol.currentScore).toBe(42);
  });

  it("getProtocol lança StpsApiError se protocolo não pertence à conta", async () => {
    await expect(client.getProtocol("unknown")).rejects.toThrow(StpsApiError);
    await expect(client.getProtocol("unknown")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("getScore retorna TrustScoreResponse do protocolo monitorado", async () => {
    const score = await client.getScore(DRIFT);

    expect(score.protocolAddress).toBe(DRIFT);
    expect(score.currentScore).toBe(42);
    expect(score.riskLevel).toBe("Critical");
  });

  it("getHistory retorna o histórico do protocolo monitorado", async () => {
    const history = await client.getHistory(DRIFT);

    expect(history).toHaveLength(3);
    expect(history[0].score).toBe(85);
    expect(history[2].reason).toBe("FLAG_TIMELOCK_REMOVED");
  });

  it("isHealthy retorna true quando /api/me responde ok", async () => {
    expect(await client.isHealthy()).toBe(true);
  });

  it("isHealthy retorna false quando a API está fora", async () => {
    const offlineClient = new StpsClient({
      token: "stps_test_token",
      apiUrl: "http://localhost:3001",
      fetchFn: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch,
    });

    expect(await offlineClient.isHealthy()).toBe(false);
  });

  it("subscribeToAlerts chama onUpdate quando score muda", async () => {
    let currentScore = 85;
    let callCount = 0;

    const dynamicFetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      const path = new URL(url).pathname;

      if (path === "/api/me") {
        return new Response(JSON.stringify(profile), { status: 200 });
      }

      const monitored: MonitoredProtocol = {
        ...driftProtocol,
        protocol: {
          ...driftScore,
          currentScore,
        },
      };

      return new Response(
        JSON.stringify({ status: "ok", count: 1, protocols: [monitored] satisfies MonitoredProtocol[] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const dynClient = new StpsClient({
      token: "stps_test_token",
      apiUrl: "http://localhost:3001",
      fetchFn: dynamicFetch,
    });

    const updates: number[] = [];
    const stop = dynClient.subscribeToAlerts(
      DRIFT,
      (protocol) => {
        callCount++;
        updates.push(protocol.protocol.currentScore);
      },
      { intervalMs: 50 },
    );

    await new Promise((r) => setTimeout(r, 20));
    expect(callCount).toBe(1);
    expect(updates[0]).toBe(85);

    await new Promise((r) => setTimeout(r, 80));
    expect(callCount).toBe(1);

    currentScore = 42;
    await new Promise((r) => setTimeout(r, 80));
    expect(callCount).toBe(2);
    expect(updates[1]).toBe(42);

    stop();
  });
});
