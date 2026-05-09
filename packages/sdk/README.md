# stps-sdk

TypeScript SDK for the **Solana Trust Protocol Standard (STPS)** — real-time trust scoring for Solana DeFi protocols.

[![npm](https://img.shields.io/npm/v/stps-sdk)](https://www.npmjs.com/package/stps-sdk)
[![license](https://img.shields.io/npm/l/stps-sdk)](LICENSE)

---

## Install

```bash
npm install stps-sdk
# or
yarn add stps-sdk
# or
pnpm add stps-sdk
```

---

## Quick Start

```typescript
import { StpsClient } from "stps-sdk";

const client = new StpsClient({
  apiUrl: "https://stps-scoring.fly.dev",
});

const score = await client.getScore("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

console.log(score.currentScore); // 42
console.log(score.riskLevel);    // "Critical"
console.log(score.activeFlags);  // ["FLAG_TIMELOCK_REMOVED", "FLAG_MULTISIG_THRESHOLD_LOWERED"]
```

---

## API

### `new StpsClient(options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `apiUrl` | `string` | `http://localhost:3001` | STPS Scoring Engine URL |
| `timeoutMs` | `number` | `10000` | Request timeout in ms |
| `fetchFn` | `typeof fetch` | `globalThis.fetch` | Custom fetch (useful for Next.js / edge) |

---

### `getScore(protocolAddress)`

Returns the current trust score for a protocol.

```typescript
const score = await client.getScore("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

score.protocolAddress  // "dRiftyHA39..."
score.currentScore     // 0–100
score.riskLevel        // "Low" | "Medium" | "High" | "Critical"
score.activeFlags      // ["FLAG_TIMELOCK_REMOVED", ...]
score.riskFlagsBitmask // "3" (on-chain bitmask as decimal string)
score.lastUpdate       // Unix timestamp (ms)
score.history          // [{ timestamp, score, reason }, ...]
```

Throws `StpsApiError` with `.status = 404` if the protocol is not tracked.

---

### `getHistory(protocolAddress)`

Returns only the score history array.

```typescript
const history = await client.getHistory("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
// [
//   { timestamp: 1711500000000, score: 85, reason: "Baseline" },
//   { timestamp: 1711540000000, score: 65, reason: "FLAG_MULTISIG_THRESHOLD_LOWERED" },
//   { timestamp: 1711586400000, score: 42, reason: "FLAG_TIMELOCK_REMOVED" },
// ]
```

---

### `getProtocols()`

Returns all tracked protocols.

```typescript
const { count, protocols } = await client.getProtocols();
protocols.forEach((p) => console.log(p.protocolAddress, p.currentScore));
```

---

### `isHealthy()`

Checks if the Scoring Engine is reachable.

```typescript
const ok = await client.isHealthy();
if (!ok) console.error("Scoring Engine is down");
```

---

### `subscribeToAlerts(protocolAddress, onUpdate, options?)`

Polls for score changes and calls `onUpdate` whenever the score or active flags change.

```typescript
const stop = client.subscribeToAlerts(
  "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
  (score) => {
    console.log(`Score changed: ${score.currentScore} (${score.riskLevel})`);
    if (score.riskLevel === "Critical") {
      alert("⚠️ Protocol at critical risk!");
    }
  },
  {
    intervalMs: 5000,  // poll every 5s (default)
    onError: (err) => console.error(err),
  },
);

// Stop polling when done
stop();
```

---

## Error Handling

```typescript
import { StpsClient, StpsApiError } from "stps-sdk";

try {
  const score = await client.getScore("unknown-address");
} catch (err) {
  if (err instanceof StpsApiError) {
    console.error(err.status); // 404
    console.error(err.body);   // { status: "not_found" }
  }
}
```

---

## Types

```typescript
type RiskLevel = "Low" | "Medium" | "High" | "Critical";

type FlagName =
  | "FLAG_TIMELOCK_REMOVED"
  | "FLAG_MULTISIG_THRESHOLD_LOWERED"
  | "FLAG_UNKNOWN_SIGNER"
  | "FLAG_EMERGENCY_KEY_USED"
  | "FLAG_WASH_TRADING"
  | "FLAG_LOW_LIQUIDITY_COLLATERAL"
  | "FLAG_NEW_TOKEN_COLLATERAL"
  | "FLAG_HIGH_HOLDER_CONCENTRATION"
  | "FLAG_PENDING_ADMIN_NONCE";

interface TrustScoreResponse {
  protocolAddress: string;
  currentScore: number;
  riskLevel: RiskLevel;
  activeFlags: FlagName[];
  riskFlagsBitmask: string;
  lastUpdate: number;
  history: ScoreHistoryEntry[];
}

interface ScoreHistoryEntry {
  timestamp: number;
  score: number;
  reason: string;
}
```

---

## Score Tiers

| Score | Risk Level | Meaning |
|---|---|---|
| 80–100 | 🟢 Low | No significant risks detected |
| 60–79 | 🟡 Medium | Minor governance concerns |
| 40–59 | 🟠 High | Significant risk flags active |
| 0–39 | 🔴 Critical | Critical vulnerabilities detected |

---

## On-Chain Verification

Every score is stored on-chain as a `ProtocolCertificate` PDA on Solana Devnet.

- **Program ID**: `FuAM2peBxYQgr4Sspd43FkYK7vuCZ5rTPxZYCnCSeCZk`
- **Explorer**: [Solana Explorer — Devnet](https://explorer.solana.com/?cluster=devnet)

---

## License

MIT
