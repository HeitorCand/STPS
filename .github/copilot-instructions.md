# STPS — GitHub Copilot Instructions

You are an AI assistant helping build the **STPS (Solana Trust Protocol Standard)** — a real-time trust scoring protocol for Solana DeFi protocols. Read this file carefully before generating any code.

---

## Project Overview

STPS assigns a **Trust Score (0–100)** to Solana protocols by monitoring:
- **L1 Governance**: multisig changes (via Squads), timelock removal, threshold reduction
- **L2 Asset Legitimacy**: wash trading, collateral age, holder concentration (via DeFiLlama)
- **L3 Durable Nonce Watchdog**: pending admin transactions using durable nonces (unique innovation)

The score is stored on-chain as a `ProtocolCertificate` PDA and served via a REST API and TypeScript SDK.

---

## Tech Stack (Authoritative — Do Not Deviate)

| Layer | Technology |
|---|---|
| Smart Contract | **Anchor 0.29+ (Rust)** — `programs/stps/` |
| Indexer | **TypeScript + Express + Helius SDK** — `packages/indexer/` |
| Scoring Engine | **TypeScript + Express** — `packages/scoring/` |
| Frontend | **Next.js 14 (App Router) + Tailwind CSS + Recharts** — `apps/dashboard/` |
| SDK | **TypeScript** — `packages/sdk/` |
| Monorepo | **pnpm workspaces + Turborepo** |

> **Do NOT suggest Python, FastAPI, or any non-TypeScript backend.** The entire backend is TypeScript.

---

## Repository Structure

```
stps/
├── programs/stps/src/
│   ├── lib.rs                  # declare_id!, instruction routing
│   ├── instructions/           # register_protocol.rs, update_score.rs, flag_alert.rs, close_certificate.rs
│   ├── state/                  # protocol_certificate.rs, wallet_reputation.rs
│   └── errors.rs               # StpsError enum
├── packages/
│   ├── indexer/src/
│   │   ├── index.ts            # Express server, POST /webhook/governance
│   │   ├── parsers/            # squads.ts, spl-governance.ts, nonce.ts
│   │   └── emitter.ts          # Sends GovernanceEvent to Scoring Engine
│   ├── scoring/src/
│   │   ├── index.ts            # Express API: GET /api/score/:id, GET /api/protocols
│   │   ├── engine/             # layer1.ts, layer2.ts, layer3.ts, aggregator.ts
│   │   ├── clients/            # defi-llama.ts (60s cache), solana-rpc.ts
│   │   └── on-chain.ts         # Signs and submits update_score to Anchor program
│   └── sdk/src/
│       ├── index.ts            # getScore(), getHistory(), subscribeToAlerts()
│       └── types.ts            # TrustScore, RiskLevel, ScoreHistory, Alert
└── apps/dashboard/app/
    ├── page.tsx                # Protocol list with scores
    └── protocol/[id]/page.tsx  # Score history chart + active alerts
```

---

## Key Data Types

### On-Chain PDA: `ProtocolCertificate`
```rust
pub struct ProtocolCertificate {
    pub authority: Pubkey,        // Scoring Authority only
    pub protocol_address: Pubkey,
    pub trust_score: u8,          // 0–100
    pub risk_level: RiskLevel,    // Low/Medium/High/Critical
    pub last_update: i64,
    pub risk_flags: u64,          // Bitmask — see SMART_CONTRACT.md
    pub bump: u8,
}
```

### `risk_flags` Bitmask (most important bits)
| Bit | Constant | Meaning |
|---|---|---|
| 0 | `FLAG_TIMELOCK_REMOVED` | Timelock removed or zeroed |
| 1 | `FLAG_MULTISIG_THRESHOLD_LOWERED` | Multisig threshold reduced |
| 8 | `FLAG_PENDING_ADMIN_NONCE` | Admin nonce with pending tx |

### API Response Shape
```typescript
interface TrustScoreResponse {
  protocol_id: string;
  protocol_address: string;
  current_score: number;          // 0–100
  risk_level: "Low" | "Medium" | "High" | "Critical";
  active_flags: string[];
  history: Array<{ timestamp: number; score: number; reason: string }>;
  layers: {
    l1_governance: LayerStatus;
    l2_assets: LayerStatus;
    l3_nonces: LayerStatus;
  };
  last_updated: number;
}
```

---

## Coding Standards

### TypeScript
- Always use **strict mode** (`"strict": true` in tsconfig)
- Use **zod** for runtime schema validation on all API endpoints
- Use **named exports** (not default exports) except for Next.js pages
- Prefer `async/await` over `.then()` chains
- Always handle errors with try/catch and log structured JSON: `{ event, error, timestamp }`
- Use **descriptive variable names** — avoid single-letter variables except loop counters

### Rust / Anchor
- Add `/// doc comments` on every instruction and every struct field
- Use `require!()` macros for all constraint checks before any state mutation
- Always emit events after state changes: `emit!(ScoreUpdated { ... })`
- Error codes must be in `errors.rs` as `StpsError` enum variants

### React / Next.js
- Use **Server Components** by default; only add `"use client"` when needed (event handlers, hooks)
- Use `loading.tsx` files for suspense boundaries instead of manual skeleton state
- All Tailwind classes must be responsive: always include `sm:`, `md:` variants for layout

---

## Security Rules — CRITICAL

1. **NEVER** include `SCORING_AUTHORITY_KEYPAIR` in any frontend code, client-side bundle, or API response.
2. **NEVER** commit `.env` files. Always use `.env.example` with placeholder values.
3. The Scoring Authority keypair must only exist in the Scoring Engine server environment.
4. All Anchor instructions must validate `authority.key() == certificate.authority` before any mutation.
5. Rate limit `POST /webhook/governance` to 100 req/min per IP.

---

## Environment Variables

| Variable | Used By | Description |
|---|---|---|
| `HELIUS_API_KEY` | indexer | Helius API key for webhooks + RPC |
| `SCORING_AUTHORITY_KEYPAIR` | scoring | JSON byte array of the authority keypair |
| `SOLANA_RPC_URL` | scoring, sdk | Helius RPC URL |
| `ANCHOR_PROGRAM_ID` | all | Deployed program address |
| `DEFI_LLAMA_BASE_URL` | scoring | `https://api.llama.fi` |
| `NEXT_PUBLIC_API_URL` | dashboard | Scoring Engine URL (public) |

---

## Score Calculation Summary

- Base score: **100**
- **L1 deductions** (governance): timelock removed = **-30**, threshold lowered = **-20**, unknown signer = **-15**, emergency key = **-25**
- **L2 deductions** (assets): wash trading = **-20**, low liquidity collateral = **-10**, new token collateral = **-8**, high holder concentration = **-12**
- **L3 deductions** (nonces): 1 pending admin nonce = **-5**, 3+ pending nonces = **-15**
- On-chain update only if `|Δscore| ≥ 5`

Full algorithm: `docs/architecture/SCORING_ALGORITHM.md`

---

## Key Reference Files

- Architecture: `docs/architecture/ARCHITECTURE.md`
- Scoring Algorithm: `docs/architecture/SCORING_ALGORITHM.md`
- Smart Contract Spec: `docs/architecture/SMART_CONTRACT.md`
- Setup Guide: `docs/guides/SETUP.md`
- Glossary: `docs/guides/GLOSSARY.md`
