# STPS Indexer

Helius Webhook listener for STPS governance events.

## Commands

```bash
npm run build --workspace=@stps/indexer
npm run test --workspace=@stps/indexer
npm run dev --workspace=@stps/indexer
```

If `pnpm` is installed:

```bash
pnpm --filter @stps/indexer build
pnpm --filter @stps/indexer test
pnpm --filter @stps/indexer dev
```

## Local Environment

Copy `.env.example` to `.env` and set:

```env
PORT=3000
SCORING_ENGINE_URL=http://localhost:3001
HELIUS_API_KEY=your_helius_api_key_here
HELIUS_WEBHOOK_SECRET=
```

## Endpoints

- `GET /health`
- `POST /webhook/governance`

## Manual Local Test

Use three terminals:

```bash
# Terminal 1: Indexer
npm run dev --workspace=@stps/indexer
```

```bash
# Terminal 2: Mock Scoring Engine
node ./packages/indexer/scripts/mock-scoring-engine.cjs
```

```powershell
# Terminal 3: Send all manual webhook fixtures
powershell -ExecutionPolicy Bypass -File .\packages\indexer\scripts\test-all-webhooks.ps1
```

Expected indexer logs include `webhook_event_detected` and `emitter_succeeded`.
Expected mock logs include `POST /internal/event` with normalized `GovernanceEvent` JSON.

For Solana devnet/testnet testing, expose the indexer with:

```bash
ngrok http 3000
```

Then configure the Helius webhook URL as:

```txt
https://your-ngrok-url/webhook/governance
```
