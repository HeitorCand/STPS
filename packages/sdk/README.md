# stps-sdk

TypeScript SDK for the authenticated **STPS operator workspace**.

This SDK reads only the protocols bound to the token holder's STPS account.

[![npm](https://img.shields.io/npm/v/stps-sdk)](https://www.npmjs.com/package/stps-sdk)
[![license](https://img.shields.io/npm/l/stps-sdk)](LICENSE)

---

## Install

```bash
npm install stps-sdk
```

---

## Quick Start

```typescript
import { StpsClient } from "stps-sdk";

const client = new StpsClient({
  token: process.env.STPS_API_TOKEN!,
});

const { protocols } = await client.getProtocols();

protocols.forEach((item) => {
  console.log(item.protocolAddress, item.protocol.currentScore, item.status);
});
```

By default, the SDK points to:

```txt
https://stps-scoring-production.up.railway.app
```

You can override it if you run your own scoring engine:

```typescript
const client = new StpsClient({
  token: process.env.STPS_TOKEN!,
  apiUrl: "http://localhost:3001",
});
```

---

## Auth Model

The SDK requires a persistent API token issued by the STPS account workspace.

Recommended flow:

- sign in on the dashboard
- create an API token in the account area
- pass that token to the SDK

The SDK sends it on every request as:

```txt
X-STPS-Token: <token>
```

---

## API

### `new StpsClient(options)`

| Option | Type | Required | Default | Description |
|---|---|---:|---|---|
| `token` | `string` | yes | - | STPS bearer token |
| `apiUrl` | `string` | no | `https://stps-scoring-production.up.railway.app` | Scoring Engine URL |
| `timeoutMs` | `number` | no | `10000` | Request timeout in ms |
| `fetchFn` | `typeof fetch` | no | `globalThis.fetch` | Custom fetch implementation |

---

### `getProfile()`

Returns the authenticated STPS account profile and session.

```typescript
const profile = await client.getProfile();

console.log(profile.user.primaryWalletAddress);
console.log(profile.session.expiresAt);
```

---

### `getProtocols()`

Returns only the protocols monitored by the authenticated account.

```typescript
const { count, protocols } = await client.getProtocols();

protocols.forEach((item) => {
  console.log(item.protocolAddress);
  console.log(item.protocol.currentScore);
  console.log(item.protocol.currentScore);
});
```

---

### `getProtocol(protocolAddress)`

Returns one monitored protocol by address.

```typescript
const protocol = await client.getProtocol("9Q3zeMUSuge341M4DkwGDdKJ9fCTAcj8HU77bKfTRtUw");

console.log(protocol.protocol.activeFlags);
```

Throws `StpsApiError` with `.status = 404` if the protocol is not attached to the current account.

---

### `getScore(protocolAddress)`

Returns the trust score object for a protocol already monitored by the authenticated account.

```typescript
const score = await client.getScore("9Q3zeMUSuge341M4DkwGDdKJ9fCTAcj8HU77bKfTRtUw");

console.log(score.currentScore);
console.log(score.riskLevel);
console.log(score.activeFlags);
```

---

### `getHistory(protocolAddress)`

Returns the score history for a monitored protocol.

```typescript
const history = await client.getHistory("9Q3zeMUSuge341M4DkwGDdKJ9fCTAcj8HU77bKfTRtUw");
```

---

### `isHealthy()`

Checks if the scoring engine is reachable with the current token.

```typescript
const ok = await client.isHealthy();
```

---

### `subscribeToAlerts(protocolAddress, onUpdate, options?)`

Polls the authenticated workspace and calls `onUpdate` when:

- score changes
- active flags change

```typescript
const stop = client.subscribeToAlerts(
  "9Q3zeMUSuge341M4DkwGDdKJ9fCTAcj8HU77bKfTRtUw",
  (protocol) => {
    console.log(protocol.protocol.currentScore, protocol.protocol.riskLevel);
  },
  { intervalMs: 5000 },
);

stop();
```

---

## Error Handling

```typescript
import { StpsApiError } from "stps-sdk";

try {
  await client.getProtocol("unknown");
} catch (err) {
  if (err instanceof StpsApiError) {
    console.error(err.status);
    console.error(err.body);
  }
}
```

---

## License

MIT
