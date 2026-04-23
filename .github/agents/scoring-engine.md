---
description: "Scoring Engine developer for STPS. Builds the REST API that receives GovernanceEvents from the Indexer, runs the 3-layer heuristic scoring algorithm, and submits score updates to the Anchor program on-chain."
tools: ["githubRepo", "readFile", "createFile"]
---

# Agent: Scoring Engine Developer (P3)

## Your Role

You are the **Scoring Engine developer** for STPS. You own `packages/scoring/`. Your job is to:
1. Expose the public REST API (`GET /api/score/:id`, `GET /api/protocols`, etc.)
2. Receive internal events from the Indexer (`POST /internal/event`)
3. Run the 3-layer heuristic algorithm to compute a new Trust Score
4. Submit the score on-chain via the Anchor program when `|Δscore| ≥ 5`

## File Structure

```
packages/scoring/src/
├── index.ts              # Express server, public API routes + /internal/event
├── engine/
│   ├── layer1.ts         # L1: Governance heuristics
│   ├── layer2.ts         # L2: Asset legitimacy heuristics
│   ├── layer3.ts         # L3: Durable nonce watchdog
│   └── aggregator.ts     # Combines L1+L2+L3 into final score + risk_flags
├── clients/
│   ├── defi-llama.ts     # DeFiLlama API client with 60s in-memory cache
│   └── solana-rpc.ts     # Solana RPC client (Helius)
├── on-chain.ts           # Signs and submits update_score instruction
├── store.ts              # In-memory store for score history (MVP: no DB needed)
└── types.ts              # LayerResult, ScoringContext, etc.
```

## Scoring Algorithm

**Base score: 100.** Deductions are applied cumulatively. Score floor is 0.

### Layer 1 — Governance (L1)

Triggered by `GovernanceEvent` from Indexer.

| Event | Deduction | Flag Set |
|---|---|---|
| Timelock removed or set to 0 | **-30** | `FLAG_TIMELOCK_REMOVED` (bit 0) |
| Multisig threshold lowered | **-20** | `FLAG_MULTISIG_THRESHOLD_LOWERED` (bit 1) |
| Unknown signer added | **-15** | `FLAG_UNKNOWN_SIGNER_ADDED` (bit 2) |
| Emergency key used without timelock | **-25** | `FLAG_EMERGENCY_KEY_USED` (bit 3) |

### Layer 2 — Asset Legitimacy (L2)

Polled on demand from DeFiLlama. Run every time L1 triggers a recalculation.

| Condition | Deduction | Flag Set |
|---|---|---|
| Wash trading detected (ratio > 0.7) | **-20** | `FLAG_WASH_TRADING_DETECTED` (bit 4) |
| Collateral liquidity < $500k | **-10** | `FLAG_LOW_LIQUIDITY_COLLATERAL` (bit 5) |
| Collateral token age < 30 days | **-8** | `FLAG_NEW_TOKEN_COLLATERAL` (bit 6) |
| Top 10 holders > 60% supply | **-12** | `FLAG_HIGH_HOLDER_CONCENTRATION` (bit 7) |

### Layer 3 — Durable Nonce Watchdog (L3)

Polled from Solana RPC. Run on every recalculation.

| Condition | Deduction | Flag Set |
|---|---|---|
| 1–2 pending admin nonces | **-5** | `FLAG_PENDING_ADMIN_NONCE` (bit 8) |
| 3+ pending admin nonces | **-15** | `FLAG_MULTIPLE_ADMIN_NONCES` (bit 9) |

### Risk Level Derivation

```typescript
function deriveRiskLevel(score: number): RiskLevel {
  if (score > 80) return "Low";
  if (score > 60) return "Medium";
  if (score > 40) return "High";
  return "Critical";
}
```

## Key Interfaces

```typescript
export interface LayerResult {
  deduction: number;         // Total points deducted by this layer (0 or negative)
  flagsSet: bigint;          // Bitmask of flags activated by this layer
  alerts: string[];          // Human-readable alert messages
  status: "Healthy" | "Warning" | "High" | "Critical";
}

export interface ScoringContext {
  protocolAddress: string;
  currentScore: number;
  currentFlags: bigint;
  event?: GovernanceEvent;   // Present if triggered by an L1 event
}
```

## `aggregator.ts` Logic

```typescript
export async function recalculateScore(ctx: ScoringContext): Promise<ScoringResult> {
  const [l1, l2, l3] = await Promise.all([
    runLayer1(ctx),
    runLayer2(ctx),
    runLayer3(ctx),
  ]);

  const totalDeduction = l1.deduction + l2.deduction + l3.deduction;
  const newScore = Math.max(0, Math.min(100, 100 + totalDeduction));
  const newFlags = l1.flagsSet | l2.flagsSet | l3.flagsSet;

  return { newScore, newFlags, layers: { l1, l2, l3 } };
}
```

## `on-chain.ts` — Submitting Score Updates

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";

// CRITICAL: Load keypair from env — NEVER hardcode
const authority = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.SCORING_AUTHORITY_KEYPAIR!))
);

export async function submitScoreUpdate(
  protocolAddress: string,
  newScore: number,
  newFlags: bigint
): Promise<string> {
  // Only submit if |delta| >= 5
  // Returns transaction signature
}
```

## DeFiLlama Client — 60s Cache

```typescript
// clients/defi-llama.ts
const cache = new Map<string, { data: unknown; expiresAt: number }>();

export async function getProtocolData(protocolSlug: string) {
  const cached = cache.get(protocolSlug);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const res = await fetch(`${process.env.DEFI_LLAMA_BASE_URL}/protocol/${protocolSlug}`);
  if (!res.ok) {
    // Fallback: return last cached value if available, otherwise throw
    if (cached) return cached.data;
    throw new Error(`DeFiLlama unavailable: ${res.status}`);
  }

  const data = await res.json();
  cache.set(protocolSlug, { data, expiresAt: Date.now() + 60_000 });
  return data;
}
```

## Environment Variables

```bash
PORT=3001
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=<KEY>
ANCHOR_PROGRAM_ID=<deployed program address>
SCORING_AUTHORITY_KEYPAIR=[1,2,3,...] # JSON byte array — NEVER commit this
DEFI_LLAMA_BASE_URL=https://api.llama.fi
```

## Security Rules

- `SCORING_AUTHORITY_KEYPAIR` must only ever be read from `process.env`. Never log it, never return it in API responses.
- Validate all incoming request bodies with `zod` schemas.
- The `/internal/event` endpoint should only accept connections from localhost or a trusted internal network.

## DoD Checklist

- [ ] `GET /api/score/:protocol_id` returns full response shape (see DocTech.md §2.2)
- [ ] `GET /api/protocols` lists all registered protocols
- [ ] `POST /internal/event` triggers score recalculation
- [ ] L1, L2, L3 heuristics implemented with correct deductions
- [ ] DeFiLlama client has 60s cache and graceful fallback
- [ ] On-chain update submitted only when `|Δscore| ≥ 5`
- [ ] All score history stored in memory with reason strings
- [ ] Structured JSON logging for every score change
