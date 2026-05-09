import "dotenv/config";
import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z, ZodError } from "zod";
import { buildChallengeMessage, createSessionExpiryIso, verifyWalletSignature } from "./auth.js";
import { getUpgradeableProgramAuthority } from "./clients/solana-rpc.js";
import { isSupabaseConfigured } from "./db.js";
import { recalculateScore } from "./engine/aggregator.js";
import { activeFlagNames } from "./flags.js";
import { logError, logInfo } from "./logger.js";
import {
  consumeChallenge,
  createApiToken,
  createAuthChallenge,
  createProtocolClaim,
  createSession,
  findClaimByProtocolAddress,
  findOrCreateUserByWallet,
  getActiveChallenge,
  getApiTokenByToken,
  getClaimByIdForUser,
  getSessionByToken,
  getUserById,
  getUserClaims,
  listApiTokensForUser,
  revokeApiTokenForUser,
  revokeSession,
  updateClaimVerification,
  type ApiTokenRecord,
  type ProtocolClaimRecord,
  type SessionRecord,
  type UserRecord,
} from "./onboarding-store.js";
import { submitRegisterProtocol } from "./on-chain.js";
import { isKnownAdminSigner } from "./protocol-catalog.js";
import { deriveRiskLevel } from "./risk-level.js";
import { getProtocol, hasProtocol, initProtocol, listProtocols } from "./store.js";
import type { GovernanceEvent, ProtocolState } from "./types.js";

type AuthenticatedRequest = Request & {
  session?: SessionRecord;
  apiToken?: ApiTokenRecord;
  user?: UserRecord;
};

const DEFAULT_INITIAL_SCORE = Number(process.env.DEFAULT_INITIAL_SCORE ?? 85);

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

const authChallengeSchema = z.object({
  walletAddress: z.string().min(32).max(64),
});

const authVerifySchema = z.object({
  challengeId: z.string().min(1),
  walletAddress: z.string().min(32).max(64),
  signature: z.string().min(16),
});

const claimProtocolSchema = z.object({
  protocolAddress: z.string().min(32).max(64),
  label: z.string().trim().min(1).max(80).optional(),
});

const verifyProtocolSchema = z.object({
  challengeId: z.string().min(1),
  signature: z.string().min(16),
});

const createApiTokenSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
});

function getSessionAuthorizationToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function getApiAccessToken(req: Request): string | null {
  const explicit = req.header("x-stps-token");
  if (explicit?.trim()) return explicit.trim();

  const header = req.header("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(/\s+/);
  if (scheme?.toLowerCase() === "token" && token) return token;
  return null;
}

async function authenticate(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ status: "onboarding_unavailable" });
    return false;
  }

  try {
    const apiTokenValue = getApiAccessToken(req);
    if (apiTokenValue) {
      const apiToken = await getApiTokenByToken(apiTokenValue);
      if (!apiToken) {
        res.status(401).json({ status: "unauthorized" });
        return false;
      }

      const user = await getUserById(apiToken.userId);
      if (!user) {
        res.status(401).json({ status: "unauthorized" });
        return false;
      }

      req.apiToken = apiToken;
      req.user = user;
      return true;
    }

    const sessionToken = getSessionAuthorizationToken(req);
    if (!sessionToken) {
      res.status(401).json({ status: "unauthorized" });
      return false;
    }

    const session = await getSessionByToken(sessionToken);
    if (!session) {
      res.status(401).json({ status: "unauthorized" });
      return false;
    }

    const user = await getUserById(session.userId);
    if (!user) {
      res.status(401).json({ status: "unauthorized" });
      return false;
    }

    req.session = session;
    req.user = user;
    return true;
  } catch (error) {
    logError("auth_lookup_failed", error);
    res.status(500).json({ status: "error" });
    return false;
  }
}

async function ensureProtocolTracked(args: {
  protocolAddress: string;
  initialScore: number;
}): Promise<{ state: ProtocolState; txSignature: string | null }> {
  const existing = getProtocol(args.protocolAddress);
  if (existing) return { state: existing, txSignature: null };

  const txSignature = await submitRegisterProtocol({
    protocolAddress: args.protocolAddress,
    initialScore: args.initialScore,
  });
  const state = initProtocol(args.protocolAddress, args.initialScore, Date.now());
  return { state, txSignature };
}

function createPlaceholderProtocol(protocolAddress: string): ReturnType<typeof serializeProtocol> {
  const timestamp = Date.now();
  return {
    protocolAddress,
    currentScore: DEFAULT_INITIAL_SCORE,
    riskLevel: deriveRiskLevel(DEFAULT_INITIAL_SCORE),
    activeFlags: [],
    riskFlagsBitmask: "0",
    lastUpdate: timestamp,
    history: [
      {
        timestamp,
        score: DEFAULT_INITIAL_SCORE,
        reason: "Baseline — protocol claimed",
      },
    ],
  };
}

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

function serializeClaim(claim: ProtocolClaimRecord) {
  const state = getProtocol(claim.protocolAddress);
  return {
    id: claim.id,
    label: claim.label,
    protocolAddress: claim.protocolAddress,
    claimedByWallet: claim.claimedByWallet,
    status: claim.status,
    verificationMethod: claim.verificationMethod,
    verificationTarget: claim.verificationTarget,
    verificationNotes: claim.verificationNotes,
    registrationTxSignature: claim.registrationTxSignature,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
    protocol: state ? serializeProtocol(state) : createPlaceholderProtocol(claim.protocolAddress),
  };
}

function serializeApiToken(record: ApiTokenRecord) {
  return {
    id: record.id,
    label: record.label,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt,
  };
}

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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-STPS-Token");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });

  app.use(express.json({ limit: "1mb" }));

  app.use(
    "/internal/event",
    rateLimit({
      windowMs: 60_000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

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

  app.get("/api/score/:protocol_id", (req: Request, res: Response) => {
    const protocolId = String(req.params.protocol_id ?? "");
    const state = getProtocol(protocolId);
    if (!state) {
      res.status(404).json({ status: "not_found", protocolAddress: protocolId });
      return;
    }
    res.json(serializeProtocol(state));
  });

  app.get("/api/protocols", (_req: Request, res: Response) => {
    const protocols = listProtocols().map(serializeProtocol);
    res.json({ count: protocols.length, protocols });
  });

  app.post("/api/protocols/register", async (req: Request, res: Response) => {
    try {
      const body = registerProtocolSchema.parse(req.body);
      const initialScore = body.initialScore ?? DEFAULT_INITIAL_SCORE;

      if (hasProtocol(body.protocolAddress)) {
        res.status(409).json({ status: "already_registered", protocolAddress: body.protocolAddress });
        return;
      }

      let txSignature: string | null = null;
      try {
        const result = await ensureProtocolTracked({
          protocolAddress: body.protocolAddress,
          initialScore,
        });
        txSignature = result.txSignature;
      } catch (error) {
        logError("register_on_chain_failed", error, { protocol_address: body.protocolAddress });
        res.status(502).json({ status: "on_chain_failed" });
        return;
      }

      const state = getProtocol(body.protocolAddress);
      res.json({
        status: "ok",
        protocolAddress: body.protocolAddress,
        initialScore,
        txSignature,
        protocol: state ? serializeProtocol(state) : createPlaceholderProtocol(body.protocolAddress),
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

  app.post("/api/auth/challenge", async (req: Request, res: Response) => {
    if (!isSupabaseConfigured()) {
      res.status(503).json({ status: "onboarding_unavailable" });
      return;
    }

    try {
      const body = authChallengeSchema.parse(req.body);
      const walletAddress = body.walletAddress;
      const { message, expiresAt } = buildChallengeMessage({
        walletAddress,
        purpose: "login",
      });

      const challenge = await createAuthChallenge({
        walletAddress,
        purpose: "login",
        challengeMessage: message,
        expiresAt,
      });

      res.json({
        status: "ok",
        challengeId: challenge.id,
        message: challenge.challengeMessage,
        expiresAt: challenge.expiresAt,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ status: "invalid_payload", issues: error.issues });
        return;
      }
      logError("auth_challenge_failed", error);
      res.status(500).json({ status: "error" });
    }
  });

  app.post("/api/auth/verify", async (req: Request, res: Response) => {
    if (!isSupabaseConfigured()) {
      res.status(503).json({ status: "onboarding_unavailable" });
      return;
    }

    try {
      const body = authVerifySchema.parse(req.body);
      const challenge = await getActiveChallenge({
        challengeId: body.challengeId,
        walletAddress: body.walletAddress,
        purpose: "login",
      });

      if (!challenge) {
        res.status(400).json({ status: "invalid_or_expired_challenge" });
        return;
      }

      const isValidSignature = verifyWalletSignature({
        walletAddress: body.walletAddress,
        message: challenge.challengeMessage,
        signatureBase64: body.signature,
      });

      if (!isValidSignature) {
        res.status(401).json({ status: "invalid_signature" });
        return;
      }

      await consumeChallenge(challenge.id);
      const user = await findOrCreateUserByWallet(body.walletAddress);
      const { token, session } = await createSession({
        userId: user.id,
        walletAddress: body.walletAddress,
        expiresAt: createSessionExpiryIso(),
      });

      res.json({
        status: "ok",
        token,
        session: {
          id: session.id,
          walletAddress: session.walletAddress,
          expiresAt: session.expiresAt,
        },
        user: {
          id: user.id,
          primaryWalletAddress: user.primaryWalletAddress,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ status: "invalid_payload", issues: error.issues });
        return;
      }
      logError("auth_verify_failed", error);
      res.status(500).json({ status: "error" });
    }
  });

  app.get("/api/me", async (req: AuthenticatedRequest, res: Response) => {
    if (!(await authenticate(req, res))) return;

    res.json({
      status: "ok",
      user: {
        id: req.user!.id,
        primaryWalletAddress: req.user!.primaryWalletAddress,
      },
      session: req.session
        ? {
            id: req.session.id,
            walletAddress: req.session.walletAddress,
            expiresAt: req.session.expiresAt,
          }
        : null,
      apiToken: req.apiToken
        ? {
            id: req.apiToken.id,
            label: req.apiToken.label,
            createdAt: req.apiToken.createdAt,
            lastUsedAt: req.apiToken.lastUsedAt,
          }
        : null,
    });
  });

  app.post("/api/me/logout", async (req: AuthenticatedRequest, res: Response) => {
    if (!(await authenticate(req, res))) return;

    try {
      const token = getSessionAuthorizationToken(req);
      if (token) await revokeSession(token);
      res.json({ status: "ok" });
    } catch (error) {
      logError("logout_failed", error);
      res.status(500).json({ status: "error" });
    }
  });

  app.get("/api/me/tokens", async (req: AuthenticatedRequest, res: Response) => {
    if (!(await authenticate(req, res))) return;

    try {
      const apiTokens = await listApiTokensForUser(req.user!.id);
      res.json({
        status: "ok",
        count: apiTokens.length,
        tokens: apiTokens.map(serializeApiToken),
      });
    } catch (error) {
      logError("list_api_tokens_failed", error, { user_id: req.user!.id });
      res.status(500).json({ status: "error" });
    }
  });

  app.post("/api/me/tokens", async (req: AuthenticatedRequest, res: Response) => {
    if (!(await authenticate(req, res))) return;
    if (!req.session) {
      res.status(401).json({ status: "session_required" });
      return;
    }

    try {
      const body = createApiTokenSchema.parse(req.body ?? {});
      const created = await createApiToken({
        userId: req.user!.id,
        label: body.label,
      });

      res.json({
        status: "ok",
        token: created.token,
        apiToken: serializeApiToken(created.apiToken),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ status: "invalid_payload", issues: error.issues });
        return;
      }
      logError("create_api_token_failed", error, { user_id: req.user!.id });
      res.status(500).json({ status: "error" });
    }
  });

  app.delete("/api/me/tokens/:tokenId", async (req: AuthenticatedRequest, res: Response) => {
    if (!(await authenticate(req, res))) return;
    if (!req.session) {
      res.status(401).json({ status: "session_required" });
      return;
    }

    try {
      const tokenId = String(req.params.tokenId ?? "");
      await revokeApiTokenForUser({
        userId: req.user!.id,
        apiTokenId: tokenId,
      });
      res.json({ status: "ok" });
    } catch (error) {
      logError("revoke_api_token_failed", error, {
        user_id: req.user!.id,
        token_id: String(req.params.tokenId ?? ""),
      });
      res.status(500).json({ status: "error" });
    }
  });

  app.get("/api/me/protocols", async (req: AuthenticatedRequest, res: Response) => {
    if (!(await authenticate(req, res))) return;

    try {
      const claims = await getUserClaims(req.user!.id);
      res.json({
        status: "ok",
        count: claims.length,
        protocols: claims.map(serializeClaim),
      });
    } catch (error) {
      logError("list_claims_failed", error, { user_id: req.user!.id });
      res.status(500).json({ status: "error" });
    }
  });

  app.post("/api/me/protocols/claim", async (req: AuthenticatedRequest, res: Response) => {
    if (!(await authenticate(req, res))) return;
    if (!req.session) {
      res.status(401).json({ status: "session_required" });
      return;
    }

    try {
      const body = claimProtocolSchema.parse(req.body);
      const existingClaim = await findClaimByProtocolAddress(body.protocolAddress);
      if (existingClaim) {
        res.status(409).json({
          status: "already_claimed",
          protocolAddress: body.protocolAddress,
        });
        return;
      }

      let txSignature: string | null = null;
      try {
        const tracked = await ensureProtocolTracked({
          protocolAddress: body.protocolAddress,
          initialScore: DEFAULT_INITIAL_SCORE,
        });
        txSignature = tracked.txSignature;
      } catch (error) {
        logError("claim_register_failed", error, { protocol_address: body.protocolAddress });
        res.status(502).json({ status: "on_chain_failed" });
        return;
      }

      const claim = await createProtocolClaim({
        userId: req.user!.id,
        protocolAddress: body.protocolAddress,
        label: body.label,
        claimedByWallet: req.session!.walletAddress,
        registrationTxSignature: txSignature,
      });

      res.json({
        status: "ok",
        claim: serializeClaim(claim),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ status: "invalid_payload", issues: error.issues });
        return;
      }
      logError("claim_protocol_failed", error, { user_id: req.user!.id });
      res.status(500).json({ status: "error" });
    }
  });

  app.post(
    "/api/me/protocols/:claimId/verification/challenge",
    async (req: AuthenticatedRequest, res: Response) => {
      if (!(await authenticate(req, res))) return;
      if (!req.session) {
        res.status(401).json({ status: "session_required" });
        return;
      }

      try {
        const claimId = String(req.params.claimId ?? "");
        const claim = await getClaimByIdForUser(claimId, req.user!.id);
        if (!claim) {
          res.status(404).json({ status: "not_found" });
          return;
        }

        const { message, expiresAt } = buildChallengeMessage({
          walletAddress: req.session!.walletAddress,
          purpose: "verify_protocol_control",
          protocolAddress: claim.protocolAddress,
        });

        const challenge = await createAuthChallenge({
          walletAddress: req.session!.walletAddress,
          purpose: "verify_protocol_control",
          protocolAddress: claim.protocolAddress,
          challengeMessage: message,
          expiresAt,
        });

        const authority = await getUpgradeableProgramAuthority(claim.protocolAddress);
        res.json({
          status: "ok",
          challengeId: challenge.id,
          message: challenge.challengeMessage,
          expiresAt: challenge.expiresAt,
          inspection: {
            upgradeAuthorityAddress: authority?.upgradeAuthorityAddress ?? null,
          },
        });
      } catch (error) {
        logError("verification_challenge_failed", error, {
          user_id: req.user!.id,
          claim_id: String(req.params.claimId ?? ""),
        });
        res.status(500).json({ status: "error" });
      }
    },
  );

  app.post(
    "/api/me/protocols/:claimId/verification/verify",
    async (req: AuthenticatedRequest, res: Response) => {
      if (!(await authenticate(req, res))) return;
      if (!req.session) {
        res.status(401).json({ status: "session_required" });
        return;
      }

      try {
        const body = verifyProtocolSchema.parse(req.body);
        const claimId = String(req.params.claimId ?? "");
        const claim = await getClaimByIdForUser(claimId, req.user!.id);
        if (!claim) {
          res.status(404).json({ status: "not_found" });
          return;
        }

        const challenge = await getActiveChallenge({
          challengeId: body.challengeId,
          walletAddress: req.session!.walletAddress,
          purpose: "verify_protocol_control",
          protocolAddress: claim.protocolAddress,
        });

        if (!challenge) {
          res.status(400).json({ status: "invalid_or_expired_challenge" });
          return;
        }

        const isValidSignature = verifyWalletSignature({
          walletAddress: req.session!.walletAddress,
          message: challenge.challengeMessage,
          signatureBase64: body.signature,
        });

        if (!isValidSignature) {
          res.status(401).json({ status: "invalid_signature" });
          return;
        }

        await consumeChallenge(challenge.id);

        const authority = await getUpgradeableProgramAuthority(claim.protocolAddress);
        let updatedClaim: ProtocolClaimRecord;

        if (authority?.upgradeAuthorityAddress === req.session!.walletAddress) {
          updatedClaim = await updateClaimVerification({
            claimId: claim.id,
            status: "verified",
            verificationMethod: "upgrade_authority",
            verificationTarget: authority.upgradeAuthorityAddress,
            verificationNotes: "Wallet matches the upgrade authority on-chain.",
          });
        } else if (isKnownAdminSigner(claim.protocolAddress, req.session!.walletAddress)) {
          updatedClaim = await updateClaimVerification({
            claimId: claim.id,
            status: "verified",
            verificationMethod: "known_admin_signer",
            verificationTarget: req.session!.walletAddress,
            verificationNotes: "Wallet matches a known admin signer configured by STPS.",
          });
        } else {
          updatedClaim = await updateClaimVerification({
            claimId: claim.id,
            status: "manual_review",
            verificationMethod: null,
            verificationTarget: authority?.upgradeAuthorityAddress ?? null,
            verificationNotes:
              "Signature is valid, but the wallet does not match the upgrade authority or a known admin signer.",
          });
        }

        res.json({
          status: "ok",
          claim: serializeClaim(updatedClaim),
        });
      } catch (error) {
        if (error instanceof ZodError) {
          res.status(400).json({ status: "invalid_payload", issues: error.issues });
          return;
        }
        logError("verification_failed", error, {
          user_id: req.user!.id,
          claim_id: String(req.params.claimId ?? ""),
        });
        res.status(500).json({ status: "error" });
      }
    },
  );

  return app;
}

const isMain = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMain) {
  const port = Number(process.env.PORT ?? 3001);
  buildScoringApp().listen(port, () => {
    logInfo("scoring_engine_started", {
      port,
      program_id: process.env.ANCHOR_PROGRAM_ID,
      rpc: process.env.SOLANA_RPC_URL,
      on_chain_disabled: (process.env.DISABLE_ON_CHAIN ?? "").toLowerCase() === "true",
      onboarding_configured: isSupabaseConfigured(),
    });
  });
}
