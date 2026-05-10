# STPS (Current State)

This document is the source of truth for what the STPS repository does today, reflecting the operator-workspace changes (wallet sign-in, protocol claim, control verification, and persistent SDK tokens).

If you are looking for the original hackathon spec, see:

- `docs/DocTech.md`
- `docs/architecture/*`
- `docs/guides/*`

## What STPS Is

STPS (Solana Trust Protocol Standard) assigns a Trust Score (0–100) to Solana protocols. The score is a protocol-level trust signal derived from risk events (governance changes, asset legitimacy signals, and latent permissions such as durable nonces). The result is exposed as a certificate-like state (score, risk level, flags, history).

Important: the score is for protocols, not for user wallets and not for an individual transaction. Transactions are inputs (events) that can change the protocol score.

## Repository Structure

- `packages/indexer`: Helius webhook receiver and transaction parsers that emit normalized governance events.
- `packages/scoring`: Scoring Engine HTTP API (Express) plus on-chain writer integration.
- `packages/sdk`: `stps-sdk` npm package (TypeScript) for reading the authenticated operator workspace.
- `programs/stps`: Anchor program (on-chain certificate state).
- `frontEnd/stps-client`: Vite + React client used as the operator dashboard (landing, login, dashboard).
- `documentation`: Fumadocs/Next app (docs site), to be updated from this document.

## Core Concepts

### Protocol Certificate

The certificate is the current trust state for a protocol:

- `protocolAddress`
- `currentScore` (0–100)
- `riskLevel` (Low/Medium/High/Critical)
- `activeFlags` (explainability)
- `history` (timeline of score changes)
- `lastUpdate`

### Governance Events (Inputs)

STPS normalizes detected activity into governance events. Examples:

- `MULTISIG_THRESHOLD_CHANGED`
- `TIMELOCK_CHANGED` (including timelock removed)
- `SIGNER_ADDED` / `SIGNER_REMOVED`
- `EMERGENCY_KEY_USED`
- Durable nonce signals (admin nonce activity)

The Indexer can detect them from webhook payloads and parsers, and the Scoring Engine can apply deductions and flags.

## Architecture (Current)

High-level pipeline:

1. Helius Webhooks deliver transaction payloads to the Indexer.
2. Indexer parses transactions into normalized `GovernanceEvent`s.
3. Scoring Engine applies deductions, flags, and recalculates the protocol score.
4. Scoring Engine writes certificate updates on-chain via the Anchor program.
5. Operator dashboard and SDK read the resulting state.

Operator experience (product layer):

1. Operator signs in with a Solana wallet.
2. Operator claims protocol program addresses into a private workspace.
3. Operator verifies control (strong path: upgrade authority signature; plus optional known admin signer list).
4. Operator can create persistent SDK access tokens to let backend services read the same account-scoped protocol surface.

## Services

### Indexer (`packages/indexer`)

Responsibilities:

- Receives webhooks at `POST /webhook/governance`.
- Parses known programs (Squads, SPL Governance, System nonce).
- Emits a normalized `GovernanceEvent` to the Scoring Engine.

Key endpoints:

- `GET /health` -> `{ "status": "ok" }`
- `POST /webhook/governance`

Key env vars (see `packages/indexer/.env.example`):

- `PORT`
- `SCORING_ENGINE_URL`
- `HELIUS_WEBHOOK_SECRET` (optional)
- `CORS_ORIGIN` (optional)

### Scoring Engine (`packages/scoring`)

Responsibilities:

- Stores and serves protocol trust state (score, flags, history).
- Authenticates operator sessions (wallet-based sign-in).
- Stores protocol claims and verification status.
- Issues persistent API tokens for SDK usage.
- Writes on-chain updates via `SCORING_AUTHORITY_KEYPAIR` and `ANCHOR_PROGRAM_ID`.

Key public endpoints:

- `GET /health`

Operator session + workspace:

- `POST /api/auth/challenge` (wallet challenge)
- `POST /api/auth/verify` (creates a session token)
- `POST /api/auth/logout`
- `GET /api/me`
- `PATCH /api/me/profile` (supports `displayName` on the backend)

Claim + verification:

- `GET /api/me/protocols`
- `POST /api/me/protocols/claim`
- `POST /api/me/protocols/:claimId/verify`

Persistent SDK tokens (account-scoped):

- `GET /api/me/tokens`
- `POST /api/me/tokens`
- `DELETE /api/me/tokens/:tokenId`

Important headers:

- Dashboard session calls use `Authorization: Bearer <session-token>`.
- SDK calls use `X-STPS-Token: <persistent-api-token>`.

Governance event ingestion:

- The Indexer emits events to the Scoring Engine.
- Local dev/demos may also inject events using `/internal/event` (use only for debugging and demos).

Key env vars (see `packages/scoring/.env.example`):

- `PORT`
- `SOLANA_RPC_URL`
- `ANCHOR_PROGRAM_ID`
- `SCORING_AUTHORITY_KEYPAIR`
- `DEFAULT_INITIAL_SCORE`
- `PROTOCOL_DEFILLAMA_MAP` / `PROTOCOL_ADMIN_KEYS_MAP`

Supabase onboarding/workspace:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_CHALLENGE_TTL_MINUTES`
- `AUTH_SESSION_TTL_HOURS`

Database schema:

- `packages/scoring/supabase/schema.sql` is the migration source (includes `display_name`, sessions, claims, and `api_tokens`).

### Operator Dashboard (`frontEnd/stps-client`)

Routes:

- `/` landing page
- `/login` wallet-based sign-in
- `/dashboard/*` authenticated area
  - `/dashboard/overview`
  - `/dashboard/protocols`
  - `/dashboard/tokens`

Behavior:

- You must be signed in to access `/dashboard`.
- If the wallet disconnects, the client returns to `/login`.
- Token management lives in `/dashboard/tokens` and creates persistent API tokens for SDK.

Config:

- `frontEnd/stps-client/.env`:
  - `VITE_STPS_SCORING_API_URL`
  - `VITE_STPS_INDEXER_API_URL`

### SDK (`packages/sdk` -> `stps-sdk`)

The SDK is an authenticated client for the operator workspace. It does not read global protocol catalogs anymore. It reads only the protocols attached to the persistent API token holder account.

Install:

```bash
npm install stps-sdk
```

Quick start:

```ts
import { StpsClient } from "stps-sdk";

const client = new StpsClient({
  token: process.env.STPS_API_TOKEN!,
});

const { protocols } = await client.getProtocols();
const score = await client.getScore(protocols[0].protocolAddress);
```

Token model:

- Create a token in the dashboard (`/dashboard/tokens`).
- Store it in a safe backend secret store.
- Pass it to the SDK as `token`.

Default API URL:

- If you do not pass `apiUrl`, the SDK uses:
  - `https://stps-scoring-production.up.railway.app`

Custom scoring engine:

```ts
const client = new StpsClient({
  token: process.env.STPS_API_TOKEN!,
  apiUrl: "http://localhost:3001",
});
```

Requests:

- The SDK sends `X-STPS-Token: <token>` on every request.

## Local Development

### Minimal operator-workspace flow (recommended)

1. Run Supabase migration:
   - Open Supabase SQL editor and run `packages/scoring/supabase/schema.sql`.
2. Start Scoring Engine:

```bash
cd packages/scoring
npm run dev
```

3. Start operator dashboard:

```bash
cd frontEnd/stps-client
npm run dev
```

4. Sign in at `/login`, claim a protocol program address, then verify control.

Notes:

- To test strong verification, use an upgradeable program where your wallet is the upgrade authority.

### Full pipeline (webhook-driven)

1. Start Indexer:

```bash
cd packages/indexer
npm run dev
```

2. Configure a Helius webhook to call:

- `POST https://<your-indexer-host>/webhook/governance`

3. Ensure Indexer can reach Scoring Engine via `SCORING_ENGINE_URL`.

## Deploy Notes

Production services in this repository have been deployed on Railway in the current setup:

- Scoring Engine: `https://stps-scoring-production.up.railway.app`
- Indexer: `https://stps-indexer-production.up.railway.app`

Health checks:

- `GET /health` should return `{ "status": "ok" }`

## Known Documentation Drift

Some older docs and the root `README.md` still reference:

- `apps/dashboard` (Next.js) as the primary frontend
- public `SDK` naming/import paths that do not match `stps-sdk`
- a public protocol catalog in the dashboard

The current product direction is:

- operator-scoped workspace (wallet sign-in)
- protocol claim + verification
- persistent API tokens for SDK access
- Vite dashboard in `frontEnd/stps-client`
