import "dotenv/config";
import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z, ZodError } from "zod";
import { recalculateScore } from "./engine/aggregator.js";
import { activeFlagNames } from "./flags.js";
import { logError, logInfo } from "./logger.js";
import { submitRegisterProtocol } from "./on-chain.js";
import { initProtocol, listProtocols, getProtocol, hasProtocol } from "./store.js";
import type { GovernanceEvent, ProtocolState } from "./types.js";

export function buildScoringApp() {
const app = express();

app.use((req, res, next) => {
  const origin = req.header("origin");
  const configuredOrigins = (process.env.CORS_ORIGIN ?? "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowsAnyOrigin = configuredOrigins.includes("*");
  const allowedOrigin = allowsAnyOrigin ? (origin ?? "*") : origin;

  if (allowedOrigin && (allowsAnyOrigin || configuredOrigins.includes(allowedOrigin))) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.use(express.json({ limit: "1mb" }));

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const governanceEventSchema = z.object({
  type: z.enum([
    "MULTISIG_THRESHOLD_CHANGED",
    "TIMELOCK_CHANGED",
    "SIGNER_ADDED",
    "SIGNER_REMOVED",
    "EMERGENCY_KEY_USED",
    "NONCE_ACCOUNT_CREATED",
    "NONCE_ADVANCED",
  ]),
  protocolAddress: z.string().min(32).max(64),
  sourceProgram: z.enum(["squads", "spl-governance", "system-nonce"]),
  rawSignature: z.string(),
  timestamp: z.number(),
  metadata: z.record(z.unknown()).default({}),
});

const registerProtocolSchema = z.object({
  protocolAddress: z.string().min(32).max(64),
  initialScore: z.number().int().min(0).max(100).optional(),
});

// ----------------------------------------------------------------------------
// Rate limit no endpoint interno (defesa em profundidade)
// ----------------------------------------------------------------------------

app.use(
  "/internal/event",
  rateLimit({
    windowMs: 60_000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ----------------------------------------------------------------------------
// Health
// ----------------------------------------------------------------------------

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// ----------------------------------------------------------------------------
// POST /internal/event — recebe GovernanceEvent do Indexer
// ----------------------------------------------------------------------------

app.post("/internal/event", async (req: Request, res: Response) => {
  try {
    const event = governanceEventSchema.parse(req.body) as GovernanceEvent;
    logInfo("governance_event_received", {
      event_type: event.type,
      protocol_address: event.protocolAddress,
      signature: event.rawSignature,
    });

    const result = await recalculateScore({
      protocolAddress: event.protocolAddress,
      event,
    });

    logInfo("score_recalculated", {
      protocol_address: result.protocolAddress,
      new_score: result.newScore,
      delta: result.delta,
      risk_level: result.riskLevel,
      persisted_on_chain: result.persistedOnChain,
      tx_signature: result.txSignature,
    });

    res.json({
      status: "ok",
      protocolAddress: result.protocolAddress,
      newScore: result.newScore,
      riskLevel: result.riskLevel,
      activeFlags: activeFlagNames(result.newFlags),
      delta: result.delta,
      persistedOnChain: result.persistedOnChain,
      txSignature: result.txSignature,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logError("event_validation_failed", error, { issues: error.issues });
      res.status(400).json({ status: "invalid_payload", issues: error.issues });
      return;
    }
    logError("event_processing_failed", error);
    res.status(500).json({ status: "error" });
  }
});

// ----------------------------------------------------------------------------
// GET /api/score/:protocol_id
// ----------------------------------------------------------------------------

app.get("/api/score/:protocol_id", (req: Request, res: Response) => {
  const protocolId = String(req.params.protocol_id ?? "");
  const state = getProtocol(protocolId);
  if (!state) {
    res.status(404).json({ status: "not_found", protocolAddress: protocolId });
    return;
  }
  res.json(serializeProtocol(state));
});

// ----------------------------------------------------------------------------
// GET /api/protocols
// ----------------------------------------------------------------------------

app.get("/api/protocols", (_req: Request, res: Response) => {
  const protocols = listProtocols().map(serializeProtocol);
  res.json({ count: protocols.length, protocols });
});

// ----------------------------------------------------------------------------
// POST /api/protocols/register
// ----------------------------------------------------------------------------

app.post("/api/protocols/register", async (req: Request, res: Response) => {
  try {
    const body = registerProtocolSchema.parse(req.body);
    const initialScore = body.initialScore ?? Number(process.env.DEFAULT_INITIAL_SCORE ?? 85);

    if (hasProtocol(body.protocolAddress)) {
      res.status(409).json({ status: "already_registered", protocolAddress: body.protocolAddress });
      return;
    }

    let txSignature: string | null = null;
    try {
      txSignature = await submitRegisterProtocol({
        protocolAddress: body.protocolAddress,
        initialScore,
      });
    } catch (error) {
      logError("register_on_chain_failed", error, { protocol_address: body.protocolAddress });
      res.status(502).json({ status: "on_chain_failed" });
      return;
    }

    const state = initProtocol(body.protocolAddress, initialScore, Date.now());
    res.json({
      status: "ok",
      protocolAddress: body.protocolAddress,
      initialScore,
      txSignature,
      protocol: serializeProtocol(state),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ status: "invalid_payload", issues: error.issues });
      return;
    }
    logError("register_failed", error);
    res.status(500).json({ status: "error" });
  }
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function serializeProtocol(state: ProtocolState) {
  return {
    protocolAddress: state.protocolAddress,
    currentScore: state.trustScore,
    riskLevel: state.riskLevel,
    activeFlags: activeFlagNames(state.riskFlags),
    riskFlagsBitmask: state.riskFlags.toString(),
    lastUpdate: state.lastUpdate,
    history: state.history,
  };
}

// ----------------------------------------------------------------------------
// Start
// ----------------------------------------------------------------------------

  return app;
}

// Só faz listen quando executado diretamente (não em testes)
const isMain = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMain) {
  const port = Number(process.env.PORT ?? 3001);
  buildScoringApp().listen(port, () => {
    logInfo("scoring_engine_started", {
      port,
      program_id: process.env.ANCHOR_PROGRAM_ID,
      rpc: process.env.SOLANA_RPC_URL,
      on_chain_disabled: (process.env.DISABLE_ON_CHAIN ?? "").toLowerCase() === "true",
    });
  });
}
