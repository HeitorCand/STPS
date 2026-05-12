# STPS — Solana Trust Protocol Standard

> The trust standard for Solana protocols.

STPS assigns a dynamic **Trust Score from 0 to 100** to Solana protocols. The
score is calculated from governance changes, asset legitimacy signals, and
latent operational risks such as durable nonces. The result is exposed as a
protocol certificate with score, risk level, active flags, and history.

The idea is simple: a transaction can be valid on-chain and still be unsafe.
STPS gives wallets, dApps, protocol teams, and integrators a continuous trust
signal before users interact with critical flows.

## Live Product

| Surface | URL |
| --- | --- |
| STPS - Client | https://stps-client.vercel.app/ |
| Documentation | https://miguelclaret.github.io/STPS/docs |
| SDK Package | https://www.npmjs.com/package/stps-sdk |

## Videos

| Video | Link |
| --- | --- |
| Pitch video | https://youtu.be/NY6tGXrOpvo |
| Demo video | https://youtu.be/zXx74rCyCOw |

## What STPS Does

- Monitors protocol-level risk instead of only individual transactions.
- Detects governance and admin changes such as timelock removal, multisig
  threshold drops, unknown signers, emergency key usage, and durable nonce risk.
- Computes an explainable Trust Score with active flags and history.
- Persists certificate state on Solana through an Anchor program.
- Exposes the same trust view through a private dashboard and `stps-sdk`.

## Current Product Flow

1. A user signs in with a Solana wallet.
2. The user adds protocol program addresses to an account-scoped workspace.
3. The dashboard shows score, risk level, flags, certificate data, and history.
4. The user creates a persistent SDK token.
5. Backend services consume the same account-scoped trust view with `stps-sdk`.

Adding a protocol to the dashboard does not require proving ownership or control
of that protocol. It creates a private watchlist entry for the signed-in account.

## SDK Quickstart

```bash
npm install stps-sdk
```

```ts
import { StpsClient } from "stps-sdk";

const client = new StpsClient({
  token: process.env.STPS_API_TOKEN!,
});

const { protocols } = await client.getProtocols();
const score = await client.getScore(protocols[0].protocolAddress);

console.log(score.currentScore);
console.log(score.riskLevel);
console.log(score.activeFlags);
```

A runnable SDK demo lives in:

```txt
examples/sdk-basic
```

## Architecture

```txt
Solana activity
  -> Helius Webhooks
  -> Indexer
  -> Scoring Engine
  -> Anchor Program
  -> Dashboard + SDK
```

| Component | Folder | Responsibility |
| --- | --- | --- |
| Anchor Program | `programs/stps` | Stores protocol Trust Score certificates as PDAs. |
| Indexer | `packages/indexer` | Receives Helius webhooks and normalizes governance events. |
| Scoring Engine | `packages/scoring` | Computes scores, flags, history, workspace auth, and SDK tokens. |
| SDK | `packages/sdk` | Published npm package for authenticated protocol trust reads. |
| Dashboard | `frontEnd/stps-client` | Wallet login, protocol watchlists, score inspection, and token creation. |
| Docs | `documentation` | Fumadocs/Next documentation site. |

## Risk Layers

| Layer | Focus |
| --- | --- |
| L1 Governance Intelligence | Timelocks, multisig thresholds, signer changes, emergency keys. |
| L2 Asset Legitimacy | Liquidity, token age, holder concentration, suspicious market activity. |
| L3 Durable Nonce Watchdog | Latent admin permissions and pre-signed operations. |

