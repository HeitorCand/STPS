# @stps/scoring

Scoring Engine do STPS (Solana Trust Protocol Standard).

Recebe `GovernanceEvent` do Indexer, executa as 3 camadas de análise (governança, ativos, nonces durables), calcula o Trust Score e — se `|Δscore| >= 5` — submete `update_score` on-chain via Anchor.

## Quick Start

```bash
cd packages/scoring
cp .env.example .env
# Editar .env com SOLANA_RPC_URL, ANCHOR_PROGRAM_ID, SCORING_AUTHORITY_KEYPAIR
pnpm install
pnpm dev
```

A API REST sobe em `http://localhost:3001` (mesma porta que o Indexer espera em `SCORING_ENGINE_URL`).

## Integração com o Indexer

O Indexer (`packages/indexer`) está configurado para enviar eventos para
`http://localhost:3001/internal/event`. O contrato é definido em
[`docs/architecture/INDEXER.md`](../../docs/architecture/INDEXER.md).

### Rodar tudo localmente

Terminal 1 — Scoring Engine (porta 3001):
```bash
pnpm dev:scoring
```

Terminal 2 — Indexer (porta 3000):
```bash
pnpm dev:indexer
```

Terminal 3 — disparar os 8 eventos de teste:
```bash
./packages/indexer/scripts/test-all-webhooks.sh   # macOS / Linux
# ou no Windows:
# powershell -ExecutionPolicy Bypass -File .\packages\indexer\scripts\test-all-webhooks.ps1
```

Verificar o estado:
```bash
curl -s http://localhost:3001/api/protocols | jq
```

Resultado esperado para o protocolo Drift após os 8 eventos: score `25`,
risk level `Critical`, com flags `FLAG_TIMELOCK_REMOVED`,
`FLAG_MULTISIG_THRESHOLD_LOWERED` e `FLAG_EMERGENCY_KEY_USED` ativas.

## Endpoints

| Método | Rota                          | Descrição                                                |
| :----- | :---------------------------- | :------------------------------------------------------- |
| `POST` | `/internal/event`             | Recebe `GovernanceEvent` do Indexer                      |
| `GET`  | `/api/score/:protocol_id`     | Score atual + histórico + flags + camadas               |
| `GET`  | `/api/protocols`              | Lista todos os protocolos registrados                   |
| `POST` | `/api/protocols/register`     | Regista novo protocolo on-chain                          |
| `GET`  | `/health`                     | Health check                                             |

## Arquitetura

Ver [`docs/architecture/LAYERS.md`](../../docs/architecture/LAYERS.md) e
[`docs/architecture/SCORING_ALGORITHM.md`](../../docs/architecture/SCORING_ALGORITHM.md).
