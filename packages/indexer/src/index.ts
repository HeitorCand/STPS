import "dotenv/config";
import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { heliusWebhookPayloadSchema } from "./schema.js";
import { emitGovernanceEvent } from "./emitter.js";
import { logError, logInfo } from "./logger.js";
import { parseNonceTransaction } from "./parsers/nonce.js";
import { parseSplGovernanceTransaction } from "./parsers/spl-governance.js";
import { parseSquadsTransaction } from "./parsers/squads.js";
import type { GovernanceEvent, HeliusWebhookPayload } from "./types.js";

export function buildIndexerApp() {
const app = express();

app.use(express.json({ limit: "1mb" }));

app.use(
  "/webhook/governance",
  rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/webhook/governance", async (req: Request, res: Response) => {
  try {
    if (!isAuthorizedWebhook(req)) {
      logError("webhook_unauthorized", "Invalid webhook secret");
      res.status(401).json({ status: "unauthorized" });
      return;
    }

    const rawPayloads = Array.isArray(req.body) ? req.body : [req.body];

    for (const rawPayload of rawPayloads) {
      const payload = heliusWebhookPayloadSchema.parse(rawPayload) as HeliusWebhookPayload;
      const event = parseGovernanceEvent(payload);

      if (event) {
        void emitGovernanceEvent(event);
        logInfo("webhook_event_detected", {
          event_type: event.type,
          protocol_address: event.protocolAddress,
          signature: event.rawSignature,
        });
      } else {
        logInfo("webhook_event_ignored", {
          signature: payload.signature,
          heliusType: payload.type,
        });
      }
    }

    res.json({ status: "ok" });
  } catch (error) {
    if (error instanceof ZodError) {
      logError("webhook_validation_failed", error, { issues: error.issues });
      res.status(400).json({ status: "invalid_payload" });
      return;
    }

    logError("webhook_processing_failed", error);
    res.json({ status: "ok" });
  }
});

  return app;
}

export function parseGovernanceEvent(payload: HeliusWebhookPayload): GovernanceEvent | null {
  return (
    parseSquadsTransaction(payload) ??
    parseSplGovernanceTransaction(payload) ??
    parseNonceTransaction(payload)
  );
}

function isAuthorizedWebhook(req: Request): boolean {
  const expectedSecret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!expectedSecret) return true;

  const receivedSecret =
    req.header("x-helius-webhook-secret") ??
    req.header("x-webhook-secret") ??
    req.query.secret;

  return receivedSecret === expectedSecret;
}

// Só faz listen quando executado diretamente (não em testes)
const isMain = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  buildIndexerApp().listen(port, () => {
    logInfo("indexer_started", { port });
  });
}
