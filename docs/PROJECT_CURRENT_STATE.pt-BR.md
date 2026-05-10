# STPS (Estado Atual)

Este documento e a fonte da verdade do que o repositório STPS faz hoje, refletindo as mudancas recentes de **workspace do operador** (login por wallet, claim de protocolo, verificação de controle e tokens persistentes para o SDK).

Se voce estiver procurando a especificação original do hackathon, veja:

- `docs/DocTech.md`
- `docs/architecture/*`
- `docs/guides/*`

## O que o STPS é

O STPS (Solana Trust Protocol Standard) atribui um Trust Score (0–100) para protocolos na Solana. O score e um sinal de confiança no nivel do **protocolo**, derivado de eventos de risco (mudancas de governanca, sinais de legitimidade de ativos e permissoes latentes como durable nonces). O resultado e exposto como um estado em formato de certificado (score, risk level, flags, historico).

Importante: o score e de **protocolo**, nao de wallet, e nao de uma transacao isolada. Transacoes entram como **inputs** (eventos) que podem alterar o score do protocolo.

## Estrutura do repositorio

- `packages/indexer`: recebe webhooks da Helius e faz parsing de transacoes, emitindo eventos normalizados.
- `packages/scoring`: Scoring Engine HTTP API (Express) e integracao opcional com escrita on-chain.
- `packages/sdk`: pacote npm `stps-sdk` (TypeScript) para ler o workspace autenticado do operador.
- `programs/stps`: programa Anchor (certificado on-chain).
- `frontEnd/stps-client`: client Vite + React (landing, login, dashboard).
- `documentation`: app Next/Fumadocs (site de docs), para ser atualizado a partir deste documento.

## Conceitos centrais

### Certificado de protocolo

O certificado e o estado atual de confianca de um protocolo:

- `protocolAddress`
- `currentScore` (0–100)
- `riskLevel` (Low/Medium/High/Critical)
- `activeFlags` (explicabilidade)
- `history` (timeline de mudancas)
- `lastUpdate`

### Governance events (inputs)

O STPS normaliza atividade em eventos de governanca. Exemplos:

- `MULTISIG_THRESHOLD_CHANGED`
- `TIMELOCK_CHANGED` (inclui timelock removido)
- `SIGNER_ADDED` / `SIGNER_REMOVED`
- `EMERGENCY_KEY_USED`
- sinais de durable nonce (atividade de nonce admin)

O Indexer detecta isso via parsers e o Scoring Engine aplica deducoes e flags.

## Arquitetura (atual)

Pipeline de alto nivel:

1. Helius Webhooks entrega payloads de transacao para o Indexer.
2. Indexer parseia transacoes em `GovernanceEvent` normalizados.
3. Scoring Engine aplica deducoes, flags e recalcula o score do protocolo.
4. Scoring Engine escreve atualizacoes on-chain via programa Anchor.
5. Dashboard do operador e SDK leem o estado resultante.

Experiencia do operador (camada de produto):

1. Operador faz login assinando com uma wallet Solana.
2. Operador faz claim de addresses (program IDs) no workspace privado.
3. Operador verifica controle (caminho forte: assinatura da upgrade authority; plus opcional: signer admin conhecido).
4. Operador cria tokens persistentes para o SDK, para que servicos backend leiam apenas os protocolos daquela conta.

## Servicos

### Indexer (`packages/indexer`)

Responsabilidades:

- Recebe webhooks em `POST /webhook/governance`.
- Parseia programas conhecidos (Squads, SPL Governance, System nonce).
- Emite `GovernanceEvent` normalizado para o Scoring Engine.

Endpoints principais:

- `GET /health` -> `{ "status": "ok" }`
- `POST /webhook/governance`

Vars de ambiente (ver `packages/indexer/.env.example`):

- `PORT`
- `SCORING_ENGINE_URL`
- `HELIUS_WEBHOOK_SECRET` (opcional)
- `CORS_ORIGIN` (opcional)

### Scoring Engine (`packages/scoring`)

Responsabilidades:

- Armazena e serve o estado de trust do protocolo (score, flags, historico).
- Autentica sessoes do operador (login por wallet).
- Armazena claims e status de verificacao.
- Emite tokens persistentes de acesso para o SDK.
- Escreve updates on-chain via `SCORING_AUTHORITY_KEYPAIR` e `ANCHOR_PROGRAM_ID`.

Endpoints publicos:

- `GET /health`

Sessao do operador + workspace:

- `POST /api/auth/challenge` (challenge da wallet)
- `POST /api/auth/verify` (cria session token)
- `POST /api/auth/logout`
- `GET /api/me`
- `PATCH /api/me/profile` (suporte a `displayName` no backend)

Claim + verificacao:

- `GET /api/me/protocols`
- `POST /api/me/protocols/claim`
- `POST /api/me/protocols/:claimId/verify`

Tokens persistentes do SDK (escopo por conta):

- `GET /api/me/tokens`
- `POST /api/me/tokens`
- `DELETE /api/me/tokens/:tokenId`

Headers importantes:

- Sessao do dashboard: `Authorization: Bearer <session-token>`.
- SDK: `X-STPS-Token: <api-token-persistente>`.

Ingestao de eventos:

- O Indexer emite eventos para o Scoring Engine.
- Em dev/demo, tambem existe `/internal/event` (use apenas para debug e demos).

Vars de ambiente (ver `packages/scoring/.env.example`):

- `PORT`
- `SOLANA_RPC_URL`
- `ANCHOR_PROGRAM_ID`
- `SCORING_AUTHORITY_KEYPAIR`
- `DEFAULT_INITIAL_SCORE`
- `PROTOCOL_DEFILLAMA_MAP` / `PROTOCOL_ADMIN_KEYS_MAP`

Supabase (onboarding/workspace):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_CHALLENGE_TTL_MINUTES`
- `AUTH_SESSION_TTL_HOURS`

Schema do banco:

- `packages/scoring/supabase/schema.sql` (inclui `display_name`, sessions, claims e `api_tokens`).

### Dashboard do operador (`frontEnd/stps-client`)

Rotas:

- `/` landing page
- `/login` login por wallet
- `/dashboard/*` area autenticada
  - `/dashboard/overview`
  - `/dashboard/protocols`
  - `/dashboard/tokens`

Comportamento:

- Voce precisa estar logado para acessar `/dashboard`.
- Se a wallet desconectar, o client volta para `/login`.
- Gestao de tokens fica em `/dashboard/tokens` e cria tokens persistentes para o SDK.

Config:

- `frontEnd/stps-client/.env`:
  - `VITE_STPS_SCORING_API_URL`
  - `VITE_STPS_INDEXER_API_URL`

### SDK (`packages/sdk` -> `stps-sdk`)

O SDK e um client autenticado para o workspace do operador. Ele nao le um catalogo global de protocolos. Ele le apenas os protocolos vinculados a conta do token persistente.

Instalacao:

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

Modelo de token:

- Crie um token no dashboard (`/dashboard/tokens`).
- Guarde esse token como segredo (backend/CI).
- Passe esse token para o SDK como `token`.

API URL default:

- Se voce nao passar `apiUrl`, o SDK usa:
  - `https://stps-scoring-production.up.railway.app`

Scoring engine custom:

```ts
const client = new StpsClient({
  token: process.env.STPS_API_TOKEN!,
  apiUrl: "http://localhost:3001",
});
```

Requisicoes:

- O SDK envia `X-STPS-Token: <token>` em todas as requests.

## Desenvolvimento local

### Fluxo minimo do workspace do operador (recomendado)

1. Rodar migration no Supabase:
   - SQL editor: rode `packages/scoring/supabase/schema.sql`.
2. Subir Scoring Engine:

```bash
cd packages/scoring
npm run dev
```

3. Subir dashboard:

```bash
cd frontEnd/stps-client
npm run dev
```

4. Entrar em `/login`, fazer claim de um program address, e verificar controle.

Notas:

- Para testar verificacao forte, use um programa upgradeable onde sua wallet e a upgrade authority.

### Pipeline completo (webhook)

1. Subir Indexer:

```bash
cd packages/indexer
npm run dev
```

2. Configurar webhook Helius para:

- `POST https://<seu-indexer-host>/webhook/governance`

3. Garantir que o Indexer alcance o Scoring Engine via `SCORING_ENGINE_URL`.

## Deploy (notas)

No setup atual, os servicos estao deployados no Railway:

- Scoring Engine: `https://stps-scoring-production.up.railway.app`
- Indexer: `https://stps-indexer-production.up.railway.app`

Health checks:

- `GET /health` deve retornar `{ "status": "ok" }`

## Drift de documentacao (o que ficou desatualizado)

Alguns docs antigos e o `README.md` ainda referenciam:

- `apps/dashboard` (Next.js) como frontend principal
- import paths antigos do SDK
- catalogo publico de protocolos no dashboard

A direcao atual do produto e:

- workspace do operador (login por wallet)
- claim + verificacao de controle
- token persistente para acesso via SDK
- dashboard Vite em `frontEnd/stps-client`
