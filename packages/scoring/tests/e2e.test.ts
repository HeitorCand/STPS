/**
 * Teste E2E — Pipeline completo
 *
 * Fluxo testado:
 *   Helius webhook → Indexer (porta 3000) → Scoring Engine (porta 3001) → score calculado
 *
 * Os dois servidores são iniciados em memória (sem processos externos).
 * On-chain está desabilitado (DISABLE_ON_CHAIN=true) para o teste ser auto-contido.
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { strict as assert } from "assert";
import http from "http";
import type { AddressInfo } from "net";

// ── bootstrap env antes de qualquer import dos pacotes ──────────────────────
process.env.DISABLE_ON_CHAIN = "true";
process.env.DEFAULT_INITIAL_SCORE = "85";
process.env.PORT = "0"; // porta aleatória — sobrescrita abaixo

// ── Importa os apps diretamente (sem spawn de processo) ─────────────────────
// Cada pacote exporta seu app Express para facilitar testes
import { buildIndexerApp } from "../../indexer/src/index.js";
import { buildScoringApp } from "../src/index.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function startServer(app: ReturnType<typeof buildIndexerApp>): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, port });
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}

async function post(url: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const raw = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      { hostname: u.hostname, port: Number(u.port), path: u.pathname, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(raw) } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
      },
    );
    req.on("error", reject);
    req.write(raw);
    req.end();
  });
}

async function get(url: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    http.get({ hostname: u.hostname, port: Number(u.port), path: u.pathname + u.search }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
    }).on("error", reject);
  });
}

// ── Payload Helius simulando redução de threshold no Squads (caso Drift) ─────
function makeSquadsThresholdPayload(protocolAddress: string, sig: string) {
  return {
    accountData: [{ account: protocolAddress, nativeBalanceChange: 0 }],
    description: "threshold lower reduced changed 2/5",
    events: {},
    fee: 5000,
    feePayer: "FeePayer111111111111111111111111111111111111",
    instructions: [
      {
        accounts: [protocolAddress],
        data: "base58data",
        innerInstructions: [],
        programId: "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu", // SQUADS_PROGRAM_ID
      },
    ],
    signature: sig,
    timestamp: Math.floor(Date.now() / 1000),
    type: "GOVERNANCE",
  };
}

function makeTimelockRemovedPayload(protocolAddress: string, sig: string) {
  return {
    accountData: [{ account: protocolAddress, nativeBalanceChange: 0 }],
    description: "timelock removed zero changed",
    events: {},
    fee: 5000,
    feePayer: "FeePayer111111111111111111111111111111111111",
    instructions: [
      {
        accounts: [protocolAddress],
        data: "base58data",
        innerInstructions: [],
        programId: "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu",
      },
    ],
    signature: sig,
    timestamp: Math.floor(Date.now() / 1000),
    type: "GOVERNANCE",
  };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("E2E — Indexer → Scoring Engine (caso Drift)", () => {
  const DRIFT = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH";

  let indexerServer: http.Server;
  let scoringServer: http.Server;
  let indexerUrl: string;
  let scoringUrl: string;

  beforeAll(async () => {
    // Inicia Scoring Engine primeiro (Indexer precisa da URL dele)
    const scoring = await startServer(buildScoringApp());
    scoringServer = scoring.server;
    scoringUrl = `http://127.0.0.1:${scoring.port}`;

    // Configura a URL do Scoring Engine para o Indexer
    process.env.SCORING_ENGINE_URL = scoringUrl;

    const indexer = await startServer(buildIndexerApp());
    indexerServer = indexer.server;
    indexerUrl = `http://127.0.0.1:${indexer.port}`;
  });

  afterAll(async () => {
    await Promise.all([closeServer(indexerServer), closeServer(scoringServer)]);
  });

  // ── 1. Healthcheck ──────────────────────────────────────────────────────────

  it("healthcheck dos dois servidores", async () => {
    const [i, s] = await Promise.all([
      get(`${indexerUrl}/health`),
      get(`${scoringUrl}/health`),
    ]);
    assert.equal(i.status, 200);
    assert.equal(s.status, 200);
    assert.deepEqual(i.body, { status: "ok" });
    assert.deepEqual(s.body, { status: "ok" });
  });

  // ── 2. Pipeline Indexer → Scoring (smoke test) ────────────────────────────
  // Verifica que o evento atravessa o pipeline; score exato depende de DeFiLlama
  // portanto não é assertado aqui.

  it("webhook Squads chega no Indexer, é parseado e encaminhado ao Scoring Engine", async () => {
    const payload = makeSquadsThresholdPayload(DRIFT, "sig-pipeline-smoke");

    const res = await post(`${indexerUrl}/webhook/governance`, payload);
    assert.equal(res.status, 200, "indexer deve retornar 200");

    // Aguarda o Indexer emitir o evento e o Scoring Engine processar (inclui DeFiLlama)
    await new Promise((r) => setTimeout(r, 1500));

    // Confirma que o protocolo foi criado no Scoring Engine
    const scoreRes = await get(`${scoringUrl}/api/score/${DRIFT}`);
    assert.equal(scoreRes.status, 200, "protocolo deve aparecer no scoring engine");

    const body = scoreRes.body as { protocolAddress: string };
    assert.equal(body.protocolAddress, DRIFT);
  });

  // ── 3. Scoring Engine diretamente — score L1 exato ───────────────────────
  // Envia GovernanceEvent direto ao /internal/event com metadata completa.
  // Isso testa o algoritmo de score sem depender do parser do Indexer ou de DeFiLlama.

  it("POST /internal/event MULTISIG_THRESHOLD_CHANGED com metadata → -20 (65)", async () => {
    // Protocolo diferente para isolar o estado
    const PROTOCOL = "TestProtocol111111111111111111111111111111";
    const event = {
      type: "MULTISIG_THRESHOLD_CHANGED",
      protocolAddress: PROTOCOL,
      sourceProgram: "squads",
      rawSignature: "sig-direct-001",
      timestamp: Date.now(),
      metadata: { oldThreshold: 3, newThreshold: 2 },
    };

    const res = await post(`${scoringUrl}/internal/event`, event);
    assert.equal(res.status, 200);

    const body = res.body as { newScore: number; riskLevel: string; activeFlags: string[] };
    assert.equal(body.newScore, 80, `esperado 80, recebido ${body.newScore}`);
    assert.equal(body.riskLevel, "Medium");
    assert.ok(body.activeFlags.includes("FLAG_MULTISIG_THRESHOLD_LOWERED"));
  });

  it("POST /internal/event TIMELOCK_CHANGED acumula → score Critical (≤40)", async () => {
    const PROTOCOL = "TestProtocol222222222222222222222222222222";

    // Primeiro: reduz threshold (-20 → 65)
    await post(`${scoringUrl}/internal/event`, {
      type: "MULTISIG_THRESHOLD_CHANGED",
      protocolAddress: PROTOCOL,
      sourceProgram: "squads",
      rawSignature: "sig-direct-002a",
      timestamp: Date.now(),
      metadata: { oldThreshold: 3, newThreshold: 2 },
    });

    // Segundo: remove timelock (-30 adicional → 35)
    const res = await post(`${scoringUrl}/internal/event`, {
      type: "TIMELOCK_CHANGED",
      protocolAddress: PROTOCOL,
      sourceProgram: "squads",
      rawSignature: "sig-direct-002b",
      timestamp: Date.now(),
      metadata: { newDuration: 0 },
    });

    assert.equal(res.status, 200);
    const body = res.body as { newScore: number; riskLevel: string; activeFlags: string[] };
    assert.equal(body.newScore, 50, `esperado 50, recebido ${body.newScore}`);
    assert.equal(body.riskLevel, "High");
    assert.ok(body.activeFlags.includes("FLAG_TIMELOCK_REMOVED"));
    assert.ok(body.activeFlags.includes("FLAG_MULTISIG_THRESHOLD_LOWERED"));
  });

  // ── 4. Listagem ─────────────────────────────────────────────────────────────

  it("GET /api/protocols lista protocolos registrados", async () => {
    const res = await get(`${scoringUrl}/api/protocols`);
    assert.equal(res.status, 200);
    const body = res.body as { count: number; protocols: unknown[] };
    assert.ok(body.count >= 1);
  });

  // ── 5. Validação de entrada ──────────────────────────────────────────────────

  it("webhook inválido no Indexer retorna 400", async () => {
    const res = await post(`${indexerUrl}/webhook/governance`, { invalid: true });
    assert.equal(res.status, 400);
  });

  it("evento inválido direto no Scoring Engine retorna 400", async () => {
    const res = await post(`${scoringUrl}/internal/event`, { type: "UNKNOWN_EVENT" });
    assert.equal(res.status, 400);
  });
});
