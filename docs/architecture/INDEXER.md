# STPS - Indexer

## Visao Geral

O Indexer e o componente P2 do STPS. Ele recebe webhooks da Helius, identifica transacoes relevantes de governanca na Solana, normaliza essas transacoes para o contrato interno `GovernanceEvent` e encaminha o resultado ao Scoring Engine.

O Indexer nao calcula score, nao escreve on-chain e nao decide penalidades. A responsabilidade dele termina quando um evento relevante e enviado para:

```txt
SCORING_ENGINE_URL/internal/event
```

Fluxo implementado:

```txt
Helius Webhook
  -> POST /webhook/governance
  -> valida payload
  -> parseSquadsTransaction / parseSplGovernanceTransaction / parseNonceTransaction
  -> GovernanceEvent
  -> emitGovernanceEvent()
  -> POST /internal/event no Scoring Engine
```

## Localizacao no Repositorio

```txt
packages/indexer/
|-- package.json
|-- tsconfig.json
|-- .env.example
|-- README.md
|-- src/
|   |-- index.ts
|   |-- constants.ts
|   |-- emitter.ts
|   |-- logger.ts
|   |-- schema.ts
|   |-- types.ts
|   `-- parsers/
|       |-- helpers.ts
|       |-- nonce.ts
|       |-- spl-governance.ts
|       `-- squads.ts
|-- scripts/
|   |-- mock-scoring-engine.cjs
|   |-- send-webhook.ps1
|   |-- test-all-webhooks.ps1
|   |-- test-webhook.ps1
|   |-- test-squads-threshold.ps1
|   |-- test-squads-timelock.ps1
|   |-- test-squads-signer-added.ps1
|   |-- test-squads-signer-removed.ps1
|   |-- test-squads-emergency.ps1
|   |-- test-spl-governance-timelock.ps1
|   |-- test-nonce-created.ps1
|   `-- test-nonce-advanced.ps1
`-- tests/
    `-- parsers.test.ts
```

## Stack

- TypeScript strict mode
- Node.js
- Express
- Zod
- express-rate-limit
- Vitest
- PowerShell scripts para testes manuais no Windows

## Variaveis de Ambiente

Arquivo local:

```txt
packages/indexer/.env
```

Modelo versionado:

```txt
packages/indexer/.env.example
```

Campos:

```env
PORT=3000
SCORING_ENGINE_URL=http://localhost:3001
HELIUS_API_KEY=your_helius_api_key_here
HELIUS_WEBHOOK_SECRET=
```

`PORT` define a porta HTTP do Indexer. O padrao e `3000`.

`SCORING_ENGINE_URL` e a URL base do Scoring Engine. O `emitter.ts` envia eventos para `${SCORING_ENGINE_URL}/internal/event`.

`HELIUS_API_KEY` fica no `.env` para compatibilidade com o setup do projeto e futuras chamadas Helius. Se a API key for exposta em chat, commit ou print publico, gere uma nova key no dashboard Helius e troque no `.env`.

`HELIUS_WEBHOOK_SECRET` e opcional. Se estiver vazio, o Indexer aceita webhooks sem validacao de segredo. Se for configurado, o Indexer valida o segredo recebido em `x-helius-webhook-secret`, `x-webhook-secret` ou `?secret=`.

## Endpoints

### `GET /health`

Health check simples.

Resposta esperada:

```json
{ "status": "ok" }
```

Uso local:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Uso via tunnel:

```powershell
Invoke-RestMethod https://SUA-URL.trycloudflare.com/health
```

### `POST /webhook/governance`

Endpoint publico que recebe webhooks da Helius.

Comportamento:

1. Aceita payload como objeto unico ou array de objetos.
2. Valida cada item com Zod.
3. Tenta parsear cada payload com os parsers disponiveis.
4. Se algum parser reconhecer o payload, emite um `GovernanceEvent`.
5. Se nenhum parser reconhecer, loga `webhook_event_ignored`.
6. Retorna `{ "status": "ok" }` quando o processamento da requisicao termina.

Importante: a Helius envia frequentemente um array de transacoes, mesmo quando ha apenas uma transacao. Por isso `index.ts` normaliza `req.body` para lista antes de processar.

## Tipos Principais

### `GovernanceEvent`

Contrato de dados entre Indexer e Scoring Engine.

```ts
export interface GovernanceEvent {
  type: GovernanceEventType;
  protocolAddress: string;
  sourceProgram: "squads" | "spl-governance" | "system-nonce";
  rawSignature: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}
```

### `GovernanceEventType`

Eventos suportados pelo Indexer:

```ts
export type GovernanceEventType =
  | "MULTISIG_THRESHOLD_CHANGED"
  | "TIMELOCK_CHANGED"
  | "SIGNER_ADDED"
  | "SIGNER_REMOVED"
  | "EMERGENCY_KEY_USED"
  | "NONCE_ACCOUNT_CREATED"
  | "NONCE_ADVANCED";
```

### Exemplo de evento emitido

```json
{
  "type": "MULTISIG_THRESHOLD_CHANGED",
  "protocolAddress": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
  "sourceProgram": "squads",
  "rawSignature": "manual-squads-threshold",
  "timestamp": 1711540000,
  "metadata": {
    "description": "Squads multisig threshold changed from 3/5 to 2/5",
    "feePayer": "FeePayer111111111111111111111111111111111",
    "accounts": ["dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"],
    "heliusType": "GOVERNANCE"
  }
}
```

## Program IDs Monitorados

### Squads

```txt
SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu
```

Usado para detectar eventos de multisig:

- threshold reduzido ou alterado
- timelock alterado/removido
- signer adicionado
- signer removido
- chave de emergencia usada

Observacao: a documentacao inicial continha um `5` extra no final do Program ID. O ID aceito pela Helius e usado no codigo e `SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu`.

### SPL Governance

```txt
GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw
```

Usado para detectar mudancas de governanca, especialmente timelock/execution delay.

### System Program

```txt
11111111111111111111111111111111
```

Usado para detectar eventos relacionados a durable nonce:

- `NONCE_ACCOUNT_CREATED`
- `NONCE_ADVANCED`

## Parsers

### `parseSquadsTransaction`

Arquivo: `packages/indexer/src/parsers/squads.ts`

Requisitos para reconhecer:

1. Alguma instruction precisa ter `programId === SQUADS_PROGRAM_ID`.
2. O texto combinado de `type`, `description` e `events` precisa conter termos esperados.

Eventos detectados:

| Evento | Heuristica atual |
| :--- | :--- |
| `MULTISIG_THRESHOLD_CHANGED` | contem `threshold` ou `quorum` e termos como `changed`, `lower`, `reduced`, `2/5` |
| `TIMELOCK_CHANGED` | contem `timelock` ou `time lock` e termos como `removed`, `zero`, `0`, `changed` |
| `EMERGENCY_KEY_USED` | contem `emergency` e termos como `used`, `executed`, `bypass` |
| `SIGNER_ADDED` | contem `signer`, `member` ou `owner` e `added`/`add` |
| `SIGNER_REMOVED` | contem `signer`, `member` ou `owner` e `removed`/`remove` |

### `parseSplGovernanceTransaction`

Arquivo: `packages/indexer/src/parsers/spl-governance.ts`

Requisitos para reconhecer:

1. Alguma instruction precisa ter `programId === SPL_GOVERNANCE_PROGRAM_ID`.
2. O texto precisa indicar mudanca de timelock, emergency execution ou threshold/quorum.

Eventos detectados:

- `TIMELOCK_CHANGED`
- `EMERGENCY_KEY_USED`
- `MULTISIG_THRESHOLD_CHANGED`

### `parseNonceTransaction`

Arquivo: `packages/indexer/src/parsers/nonce.ts`

Requisitos para reconhecer:

1. Alguma instruction precisa ter `programId === SYSTEM_PROGRAM_ID`.
2. O texto precisa indicar inicializacao ou avanco de nonce.

Eventos detectados:

| Evento | Heuristica atual |
| :--- | :--- |
| `NONCE_ACCOUNT_CREATED` | `nonceInitialize`, `initialize nonce`, `nonce account created`, `create nonce` |
| `NONCE_ADVANCED` | `nonceAdvance`, `advance nonce`, `nonce advanced` |

## Emitter

Arquivo: `packages/indexer/src/emitter.ts`

Responsabilidade:

```txt
GovernanceEvent -> POST ${SCORING_ENGINE_URL}/internal/event
```

Comportamento:

- Se `SCORING_ENGINE_URL` nao estiver configurado, loga `emitter_not_configured`.
- Se o Scoring Engine responder status nao-2xx, loga `emitter_failed`.
- Se o fetch falhar, loga `emitter_failed`.
- Se o envio funcionar, loga `emitter_succeeded`.
- Nunca derruba o processo por erro do Scoring Engine.

Esse comportamento e importante porque o webhook da Helius nao deve falhar por indisponibilidade temporaria da P3.

## Logs Estruturados

Todos os logs importantes sao JSON.

### Servidor iniciado

```json
{"event":"indexer_started","timestamp":1777606325081,"port":3000}
```

### Evento reconhecido

```json
{
  "event": "webhook_event_detected",
  "timestamp": 1777606346286,
  "event_type": "MULTISIG_THRESHOLD_CHANGED",
  "protocol_address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
  "signature": "manual-squads-threshold"
}
```

### Evento ignorado

```json
{
  "event": "webhook_event_ignored",
  "timestamp": 1777606762638,
  "signature": "28JnD9Y2Fbum98YheL3Tr54DDA2qQR5GzYuJzGDdNTCE3ZUNJTykKj8nAtvuoJHiW1gSQ8uzTehkoBSw16hRHDYK",
  "heliusType": "TRANSFER"
}
```

Eventos ignorados sao esperados quando a Helius envia transacoes como `TRANSFER`, `INITIALIZE_ACCOUNT` ou `UNKNOWN` que nao sao governanca relevante.

### Emitter bem-sucedido

```json
{
  "event": "emitter_succeeded",
  "timestamp": 1777606346320,
  "event_type": "MULTISIG_THRESHOLD_CHANGED",
  "protocol_address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
  "signature": "manual-squads-threshold"
}
```

### Payload invalido

```json
{
  "event": "webhook_validation_failed",
  "error": "Expected object, received array",
  "timestamp": 1777606670212
}
```

Esse erro existia antes do suporte a arrays da Helius. O endpoint agora aceita tanto objeto unico quanto array.

## Rate Limit

O endpoint `POST /webhook/governance` usa 100 requests por minuto por IP via `express-rate-limit`.

## Comandos

### Instalar dependencias

Na raiz do repositorio:

```powershell
npx pnpm@8.15.9 install
```

### Rodar o Indexer

```powershell
npx pnpm@8.15.9 --filter @stps/indexer dev
```

Alternativa via npm workspace:

```powershell
npm run dev --workspace=@stps/indexer
```

### Build

```powershell
npm run build --workspace=@stps/indexer
```

### Testes unitarios

```powershell
npm run test --workspace=@stps/indexer
```

## Teste Local Completo com Mock

Enquanto a P3 nao entrega o Scoring Engine, usamos `packages/indexer/scripts/mock-scoring-engine.cjs`.

Ele sobe um servidor HTTP na porta `3001` e imprime tudo que recebe em `POST /internal/event`.

### Terminal 1 - Indexer

```powershell
npx pnpm@8.15.9 --filter @stps/indexer dev
```

### Terminal 2 - Mock Scoring Engine

```powershell
node .\packages\indexer\scripts\mock-scoring-engine.cjs
```

Saida esperada:

```txt
mock scoring on http://localhost:3001
```

### Terminal 3 - Enviar todos os eventos manuais

```powershell
powershell -ExecutionPolicy Bypass -File .\packages\indexer\scripts\test-all-webhooks.ps1
```

No terminal do Indexer, a saida esperada inclui `webhook_event_detected` e `emitter_succeeded`.

No terminal do mock, a saida esperada inclui:

```txt
POST /internal/event
{"type":"MULTISIG_THRESHOLD_CHANGED", ...}
```

## Scripts Manuais

### `send-webhook.ps1`

Helper usado pelos demais scripts. Ele monta um payload no formato Helius-like e envia para `http://localhost:3000/webhook/governance`.

Parametros principais:

- `Description`
- `ProgramId`
- `Data`
- `Signature`
- `Type`
- `ProtocolAddress`
- `Timestamp`

### Scripts de evento

| Script | Evento esperado |
| :--- | :--- |
| `test-squads-threshold.ps1` | `MULTISIG_THRESHOLD_CHANGED` |
| `test-squads-timelock.ps1` | `TIMELOCK_CHANGED` |
| `test-squads-signer-added.ps1` | `SIGNER_ADDED` |
| `test-squads-signer-removed.ps1` | `SIGNER_REMOVED` |
| `test-squads-emergency.ps1` | `EMERGENCY_KEY_USED` |
| `test-spl-governance-timelock.ps1` | `TIMELOCK_CHANGED` com `sourceProgram = "spl-governance"` |
| `test-nonce-created.ps1` | `NONCE_ACCOUNT_CREATED` |
| `test-nonce-advanced.ps1` | `NONCE_ADVANCED` |

### Rodar tudo

```powershell
powershell -ExecutionPolicy Bypass -File .\packages\indexer\scripts\test-all-webhooks.ps1
```

## Teste com Helius

### 1. Rodar Indexer local

```powershell
npx pnpm@8.15.9 --filter @stps/indexer dev
```

### 2. Rodar mock Scoring Engine

```powershell
node .\packages\indexer\scripts\mock-scoring-engine.cjs
```

### 3. Criar tunnel publico

Cloudflare Tunnel foi mais estavel que LocalTunnel durante os testes.

Use `127.0.0.1`, nao `localhost`, para evitar erro de IPv6 no Windows:

```powershell
npx cloudflared tunnel --url http://127.0.0.1:3000
```

O Cloudflare imprime uma URL parecida com:

```txt
https://hypothesis-jeff-tax-there.trycloudflare.com
```

### 4. Testar health via tunnel

```powershell
Invoke-RestMethod https://hypothesis-jeff-tax-there.trycloudflare.com/health
```

Resposta esperada:

```txt
status
------
ok
```

### 5. Configurar Helius

No dashboard Helius:

```txt
Webhooks -> Create Webhook
```

Webhook URL:

```txt
https://SUA-URL.trycloudflare.com/webhook/governance
```

Transaction type:

```txt
Any
```

Account addresses:

```txt
SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu
GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw
11111111111111111111111111111111
```

### 6. Resultado esperado

Quando a Helius chega no Indexer com payload nao relevante:

```json
{"event":"webhook_event_ignored","heliusType":"TRANSFER"}
```

Isso e sucesso de conectividade:

```txt
Helius -> Cloudflare Tunnel -> Indexer
```

Quando chegar evento reconhecido:

```json
{"event":"webhook_event_detected","event_type":"TIMELOCK_CHANGED"}
```

## Problemas Encontrados e Solucoes

### PowerShell `curl` quebra JSON

No PowerShell, `curl` pode ser alias de `Invoke-WebRequest`, e `curl.exe -d` com JSON multiline tambem pode quebrar aspas.

Solucao: usar scripts `.ps1` versionados, especialmente:

```powershell
powershell -ExecutionPolicy Bypass -File .\packages\indexer\scripts\test-webhook.ps1
```

### Helius envia array

Erro anterior:

```txt
Expected object, received array
```

Solucao implementada: o endpoint aceita objeto unico e array de objetos.

### LocalTunnel com 429

Erro:

```txt
429 Too Many Requests
```

Solucao: usar Cloudflare Tunnel.

### Cloudflare nao alcanca `localhost`

Erro:

```txt
dial tcp [::1]:3000: connectex
```

Causa: `localhost` pode resolver para IPv6 `[::1]` no Windows.

Solucao:

```powershell
npx cloudflared tunnel --url http://127.0.0.1:3000
```

### Emitter falha com `fetch failed`

Esse erro aparece quando nao existe nada rodando em `SCORING_ENGINE_URL`.

Durante desenvolvimento, rode:

```powershell
node .\packages\indexer\scripts\mock-scoring-engine.cjs
```

Depois que a P3 entregar o Scoring Engine real, parar o mock e usar a API real.

## Status Atual da Entrega P2

Concluido:

- Pacote `@stps/indexer` criado.
- Servidor Express funcionando.
- `GET /health` funcionando.
- `POST /webhook/governance` funcionando.
- Suporte a payload Helius como objeto unico e array.
- Rate limiting aplicado.
- Parsers de Squads, SPL Governance e Nonce implementados.
- `GovernanceEvent` normalizado.
- Emitter para Scoring Engine implementado.
- Mock de Scoring Engine implementado.
- Scripts manuais de teste implementados.
- Testes unitarios dos parsers implementados.
- Helius integrado via Cloudflare Tunnel.
- Eventos irrelevantes da Helius sao ignorados corretamente.
- Eventos manuais reconhecidos sao enviados para o mock.

Dependencias externas:

- Integrar com Scoring Engine real da P3.
- Coletar fixtures reais da Helius para eventos Squads/SPL/Nonce.
- Refinar heuristicas dos parsers com base nesses fixtures reais.

Melhorias recomendadas:

- Adicionar retry com backoff no `emitter.ts`.
- Logar `programIds` em `webhook_event_ignored`.
- Persistir fixtures reais em `tests/fixtures`.
- Adicionar testes para payload Helius em array.

## Checklist de Demo para P2

Antes de apresentar:

- [ ] `npm run build --workspace=@stps/indexer` passa.
- [ ] `npm run test --workspace=@stps/indexer` passa.
- [ ] `Invoke-RestMethod http://127.0.0.1:3000/health` retorna `ok`.
- [ ] Mock Scoring Engine esta rodando em `3001`.
- [ ] `test-all-webhooks.ps1` retorna `ok` para todos os eventos.
- [ ] Terminal do Indexer mostra `webhook_event_detected`.
- [ ] Terminal do mock mostra `POST /internal/event`.
- [ ] Cloudflare Tunnel esta rodando com `http://127.0.0.1:3000`.
- [ ] URL `/health` via tunnel retorna `ok`.
- [ ] Helius aponta para `/webhook/governance`.
- [ ] Helius gera logs `webhook_event_ignored` ou `webhook_event_detected` no Indexer.
