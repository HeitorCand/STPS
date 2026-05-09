/**
 * Testes unitários do @stps/sdk
 *
 * Usa fetch mockado — sem dependência de servidor real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StpsClient, StpsApiError } from "../src/index.js";
import type { TrustScoreResponse, ProtocolListResponse } from "../src/index.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

const jupiterScore: TrustScoreResponse = {
  protocolAddress: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  currentScore: 95,
  riskLevel: "Low",
  activeFlags: [],
  riskFlagsBitmask: "0",
  lastUpdate: Date.now(),
  history: [{ timestamp: Date.now(), score: 95, reason: "Baseline" }],
};

function mockFetch(responses: Record<string, unknown>): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = new URL(url).pathname;
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

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("StpsClient", () => {
  let client: StpsClient;

  beforeEach(() => {
    client = new StpsClient({
      apiUrl: "http://localhost:3001",
      fetchFn: mockFetch({
        "/api/score/dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH": driftScore,
        "/api/score/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": jupiterScore,
        "/api/protocols": { count: 2, protocols: [driftScore, jupiterScore] } satisfies ProtocolListResponse,
        "/health": { status: "ok" },
      }),
    });
  });

  // ── getScore ───────────────────────────────────────────────────────────────

  it("getScore retorna TrustScoreResponse completo", async () => {
    const score = await client.getScore(DRIFT);

    expect(score.protocolAddress).toBe(DRIFT);
    expect(score.currentScore).toBe(42);
    expect(score.riskLevel).toBe("Critical");
    expect(score.activeFlags).toContain("FLAG_TIMELOCK_REMOVED");
    expect(score.activeFlags).toContain("FLAG_MULTISIG_THRESHOLD_LOWERED");
    expect(score.history).toHaveLength(3);
  });

  it("getScore para protocolo Low risk", async () => {
    const score = await client.getScore("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

    expect(score.currentScore).toBe(95);
    expect(score.riskLevel).toBe("Low");
    expect(score.activeFlags).toHaveLength(0);
  });

  it("getScore lança StpsApiError em 404", async () => {
    const badClient = new StpsClient({
      apiUrl: "http://localhost:3001",
      fetchFn: mockFetch({}), // sem rotas → 404 pra tudo
    });

    await expect(badClient.getScore("EnderecoInexistente")).rejects.toThrow(StpsApiError);
    await expect(badClient.getScore("EnderecoInexistente")).rejects.toMatchObject({
      status: 404,
    });
  });

  // ── getHistory ─────────────────────────────────────────────────────────────

  it("getHistory retorna array de entradas históricas", async () => {
    const history = await client.getHistory(DRIFT);

    expect(history).toHaveLength(3);
    expect(history[0].score).toBe(85);
    expect(history[0].reason).toBe("Baseline");
    expect(history[2].score).toBe(42);
    expect(history[2].reason).toBe("FLAG_TIMELOCK_REMOVED");
  });

  // ── getProtocols ───────────────────────────────────────────────────────────

  it("getProtocols retorna lista paginada", async () => {
    const result = await client.getProtocols();

    expect(result.count).toBe(2);
    expect(result.protocols).toHaveLength(2);
    expect(result.protocols[0].protocolAddress).toBe(DRIFT);
  });

  // ── isHealthy ──────────────────────────────────────────────────────────────

  it("isHealthy retorna true quando API responde ok", async () => {
    expect(await client.isHealthy()).toBe(true);
  });

  it("isHealthy retorna false quando API está fora", async () => {
    const offlineClient = new StpsClient({
      apiUrl: "http://localhost:3001",
      fetchFn: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch,
    });

    expect(await offlineClient.isHealthy()).toBe(false);
  });

  // ── subscribeToAlerts ──────────────────────────────────────────────────────

  it("subscribeToAlerts chama onUpdate quando score muda", async () => {
    let callCount = 0;
    let currentScore = 85;
    const updates: number[] = [];

    const dynamicFetch = vi.fn(async () => {
      const body: TrustScoreResponse = { ...driftScore, currentScore, history: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;

    const dynClient = new StpsClient({
      apiUrl: "http://localhost:3001",
      fetchFn: dynamicFetch,
      intervalMs: 50,
    } as any);

    const stop = dynClient.subscribeToAlerts(
      DRIFT,
      (score) => { callCount++; updates.push(score.currentScore); },
      { intervalMs: 50 },
    );

    // Primeira chamada — imediata (poll chamado via void no construtor)
    await new Promise((r) => setTimeout(r, 20));
    expect(callCount).toBe(1);
    expect(updates[0]).toBe(85);

    // Score não mudou — sem nova chamada
    await new Promise((r) => setTimeout(r, 80));
    expect(callCount).toBe(1);

    // Score mudou → deve disparar na próxima poll
    currentScore = 42;
    await new Promise((r) => setTimeout(r, 80));
    expect(callCount).toBe(2);
    expect(updates[1]).toBe(42);

    stop();
  });

  it("subscribeToAlerts para de chamar após stop()", async () => {
    let callCount = 0;
    const stop = client.subscribeToAlerts(
      DRIFT,
      () => { callCount++; },
      { intervalMs: 50 },
    );

    // Aguarda primeira chamada imediata
    await new Promise((r) => setTimeout(r, 20));
    expect(callCount).toBe(1);

    stop();

    // Aguarda mais 3 intervalos — não deve chamar novamente
    await new Promise((r) => setTimeout(r, 200));
    expect(callCount).toBe(1);
  });
});
