# 🗺️ Roteiro de Execução — STPS Hackathon

> **Meta:** Sistema funcional em 3 semanas com demo ao vivo do caso Drift.
> **Critério de vitória:** Juiz consegue ver o score cair em tempo real + verificar o certificado on-chain.

---

## Como Usar Este Roteiro

Cada tarefa tem:
- **Responsável** (P1–P5)
- **Depende de** (pré-requisito)
- **Entrega verificável** (como saber que está pronto)
- **Tempo estimado**

Trabalhe sempre na branch `feature/<nome-da-task>` e abra PR para `develop`.

---

## ⚙️ Dia 0 — Setup do Time (2–3 horas)

> Fazer isso **antes** de qualquer código. Todo o time junto.

### D0.1 — Monorepo base
**Responsável:** P5 (Tech Lead)
**Entrega:** `pnpm install` funciona na raiz, Turborepo configurado

```bash
# Criar estrutura de pastas
mkdir -p programs/stps/src/{instructions,state}
mkdir -p packages/{indexer,scoring,sdk}/src
mkdir -p apps/dashboard/app
mkdir -p .github/agents

# Inicializar workspace
cat > package.json << 'EOF'
{
  "name": "stps",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test"
  }
}
EOF

pnpm add -D turbo -w
```

### D0.2 — Anchor init
**Responsável:** P1
**Entrega:** `anchor build` sem erros

```bash
anchor init stps --no-git
# Copiar src para programs/stps/src/
```

### D0.3 — Variáveis de ambiente
**Responsável:** P5
**Entrega:** Todos com `.env` preenchido e Helius API key

```bash
# Criar .env.example em cada pacote
# Fazer airdrop de SOL devnet para as keypairs do time
solana airdrop 2 --url devnet
```

### D0.4 — Configurar ngrok para Helius webhook
**Responsável:** P2
**Entrega:** URL do webhook configurada no Helius dashboard

---

## 🏗️ Semana 1 — Fundação (Dias 1–7)

### Fase 1A: Smart Contract (P1) — Dias 1–3

> **Objetivo:** Programa deployado na Devnet com todas as instruções funcionando.

#### TASK-01 · Structs e state
**Responsável:** P1 | **Tempo:** 3h

Criar os arquivos de estado:

```
programs/stps/src/state/
├── protocol_certificate.rs   ← ProtocolCertificate + constantes de flags
├── wallet_reputation.rs      ← WalletReputation
└── risk_level.rs             ← RiskLevel enum + from_score()
```

**Entrega verificável:** `anchor build` compila sem warnings.

---

#### TASK-02 · Instrução `register_protocol`
**Responsável:** P1 | **Tempo:** 2h | **Depende de:** TASK-01

```rust
// programs/stps/src/instructions/register_protocol.rs
pub fn register_protocol(ctx, protocol_address, initial_score) -> Result<()>
```

**Entrega verificável:** Teste passa:
```bash
anchor test -- --grep "register_protocol"
```

---

#### TASK-03 · Instrução `update_score`
**Responsável:** P1 | **Tempo:** 2h | **Depende de:** TASK-02

Inclui validação de `authority`, evento `ScoreUpdated`, e `StpsError::Unauthorized`.

**Entrega verificável:** Teste passa com autoridade correta E falha com autoridade errada.

---

#### TASK-04 · Instruções `flag_alert` + `close_certificate`
**Responsável:** P1 | **Tempo:** 2h | **Depende de:** TASK-03

**Entrega verificável:** Suite completa de testes passando.

---

#### TASK-05 · Deploy na Devnet
**Responsável:** P1 | **Tempo:** 1h | **Depende de:** TASK-04

```bash
anchor deploy --provider.cluster devnet
```

**Entrega verificável:**
- Program ID postado no canal do time
- `ANCHOR_PROGRAM_ID` atualizado em todos os `.env`
- IDL commitado em `target/idl/stps.json`

---

### Fase 1B: Indexer (P2) — Dias 1–4

> **Objetivo:** Webhook recebendo e normalizando eventos de governança.

#### TASK-06 · Setup Express + endpoint base
**Responsável:** P2 | **Tempo:** 2h

```bash
cd packages/indexer
pnpm init
pnpm add express zod express-rate-limit
pnpm add -D typescript @types/express ts-node-dev
```

Criar `src/index.ts` com:
- `POST /webhook/governance` (stub que loga o payload)
- `GET /health`
- Rate limiting configurado

**Entrega verificável:** `curl localhost:3000/health` retorna `{"status":"ok"}`

---

#### TASK-07 · Parser Squads
**Responsável:** P2 | **Tempo:** 3h | **Depende de:** TASK-06

Criar `src/parsers/squads.ts` detectando:
- `MULTISIG_THRESHOLD_CHANGED`
- `SIGNER_ADDED` / `SIGNER_REMOVED`
- `EMERGENCY_KEY_USED`

**Entrega verificável:** Teste unitário com payload fixture do Squads retorna `GovernanceEvent` correto.

---

#### TASK-08 · Parser Nonce + Emitter
**Responsável:** P2 | **Tempo:** 3h | **Depende de:** TASK-07

Criar:
- `src/parsers/nonce.ts` detectando `NONCE_ADVANCED` por admin keys
- `src/emitter.ts` com POST para Scoring Engine

**Entrega verificável:** Evento chega no Scoring Engine quando webhook é disparado manualmente.

---

### Fase 1C: Scoring Engine — API Base (P3) — Dias 1–5

> **Objetivo:** API retornando scores (mesmo que hardcoded) para o Frontend poder começar.

#### TASK-09 · Setup Express + store in-memory
**Responsável:** P3 | **Tempo:** 2h

```bash
cd packages/scoring
pnpm init
pnpm add express zod @coral-xyz/anchor @solana/web3.js
```

Criar `src/store.ts`:
```typescript
// Map simples: protocolAddress → { score, history, flags }
const protocols = new Map<string, ProtocolState>();
```

**Entrega verificável:** `GET /api/protocols` retorna array (mesmo vazio).

---

#### TASK-10 · Endpoints públicos da API
**Responsável:** P3 | **Tempo:** 3h | **Depende de:** TASK-09

Implementar com schema Zod:
- `GET /api/score/:protocol_id`
- `GET /api/protocols`
- `GET /api/wallet/:address`

**Entrega:** Response shape exata conforme `DocTech.md §2.2`.

---

#### TASK-11 · Seed com dados do caso Drift
**Responsável:** P3 | **Tempo:** 1h | **Depende de:** TASK-10

Criar `src/seed.ts` com o histórico hardcoded do Drift:
```typescript
store.set("Drift_V2", {
  protocol_address: "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
  current_score: 42,
  history: [
    { timestamp: 1711500000, score: 85, reason: "Baseline" },
    { timestamp: 1711540000, score: 65, reason: "FLAG_MULTISIG_THRESHOLD_LOWERED" },
    { timestamp: 1711586400, score: 42, reason: "FLAG_TIMELOCK_REMOVED" },
  ],
  // ...
});
```

**Entrega verificável:** `GET /api/score/Drift_V2` retorna os dados do caso Drift.

---

### Fase 1D: Frontend — Scaffold (P4) — Dias 1–4

> **Objetivo:** Dashboard funcionando com dados mockados (não espera o backend ficar pronto).

#### TASK-12 · Setup Next.js 14
**Responsável:** P4 | **Tempo:** 1h

```bash
cd apps/dashboard
pnpm create next-app@latest . --typescript --tailwind --app --no-src-dir
```

**Entrega:** `pnpm dev` abre no browser sem erros.

---

#### TASK-13 · Componentes base
**Responsável:** P4 | **Tempo:** 3h | **Depende de:** TASK-12

Criar com dados mockados (sem API ainda):
- `components/RiskBadge.tsx` — badge colorido por risk level
- `components/ProtocolCard.tsx` — card do protocolo com score
- `components/ScoreChart.tsx` — gráfico Recharts com linha de score

```bash
pnpm add recharts
pnpm add -D @types/recharts
```

**Entrega verificável:** Storybook ou página `/dev` mostrando todos os componentes.

---

#### TASK-14 · Página principal `/`
**Responsável:** P4 | **Tempo:** 2h | **Depende de:** TASK-13

Lista de protocolos com score, badge e link para detalhe.
Usar dados mockados por enquanto — conectar à API na Semana 2.

**Entrega verificável:** Página renderiza em mobile (375px) e desktop (1280px).

---

### ✅ Checkpoint Semana 1 (Dia 7)

Todo o time faz uma reunião de integração:

- [ ] P1: `anchor deploy` feito, IDL commitado, Program ID compartilhado
- [ ] P2: Webhook recebendo e normalizando eventos
- [ ] P3: `GET /api/score/Drift_V2` retornando dados corretos
- [ ] P4: Dashboard rodando localmente com dados mockados
- [ ] P5: Todos os `.env` sincronizados, branches mergeadas em `develop`

---

## 🎯 Semana 2 — O "Demo Killer" (Dias 8–14)

### Fase 2A: Scoring Engine — Algoritmo Real (P3) — Dias 8–11

#### TASK-15 · Heurísticas L1
**Responsável:** P3 | **Tempo:** 4h | **Depende de:** TASK-08 (GovernanceEvent chegando)

Criar `src/engine/layer1.ts`:
```typescript
export function runLayer1(event: GovernanceEvent): LayerResult {
  // Mapear event.type → deduction + flag
  // MULTISIG_THRESHOLD_CHANGED → -20, FLAG_MULTISIG_THRESHOLD_LOWERED
  // TIMELOCK_CHANGED (to 0) → -30, FLAG_TIMELOCK_REMOVED
  // ...
}
```

**Entrega:** Testes unitários para cada tipo de evento.

---

#### TASK-16 · Cliente DeFiLlama + Heurísticas L2
**Responsável:** P3 | **Tempo:** 4h | **Depende de:** TASK-15

Criar `src/clients/defi-llama.ts` com cache de 60s, depois `src/engine/layer2.ts`.

**Entrega:** Cache respeitado (verificar com logs de timestamp).

---

#### TASK-17 · Cliente RPC + Heurísticas L3
**Responsável:** P3 | **Tempo:** 3h | **Depende de:** TASK-16

Criar `src/clients/solana-rpc.ts` para consultar nonce accounts, depois `src/engine/layer3.ts`.

**Entrega:** Dado um endereço de nonce account com tx pendente, detecta corretamente.

---

#### TASK-18 · Aggregator + on-chain submit
**Responsável:** P3 | **Tempo:** 4h | **Depende de:** TASK-17, TASK-05

Criar `src/engine/aggregator.ts` combinando L1+L2+L3, e `src/on-chain.ts` para submeter `update_score`.

**Entrega verificável:**
1. Simular evento via `POST /internal/event`
2. Score calculado corretamente
3. Transação confirmada na Devnet
4. `anchor account ProtocolCertificate <address>` mostra novo score

---

### Fase 2B: Integração Frontend ↔ API (P4) — Dias 8–11

#### TASK-19 · Conectar API real
**Responsável:** P4 | **Tempo:** 2h | **Depende de:** TASK-10

Substituir dados mockados por `fetch` real para o Scoring Engine.

**Entrega:** Dashboard mostrando dados do Drift sem nenhum mock.

---

#### TASK-20 · Página de detalhe `/protocol/[id]`
**Responsável:** P4 | **Tempo:** 4h | **Depende de:** TASK-19

Incluir:
- `ScoreChart` com dados históricos reais
- `AlertList` com flags ativas
- `loading.tsx` com skeleton
- Empty state para protocolo não encontrado

**Entrega:** Acessar `/protocol/Drift_V2` mostra gráfico com a queda de score.

---

#### TASK-21 · Página Demo Drift `/demo/drift`
**Responsável:** P4 | **Tempo:** 6h | **Depende de:** TASK-20

> Esta é a **peça mais importante para o pitch**. Dedicar tempo extra aqui.

Componente `DriftTimeline`:
- Timeline horizontal animada com os 3 eventos
- Score counter que "conta" de 85 para 42 com animação
- Banner: *"⚠️ STPS teria alertado você 11 horas antes do exploit"*
- Botão "Ver on-chain" que abre o explorador Solana no certificado

**Entrega:** Animação fluida em mobile e desktop. Pronto para gravação do pitch.

---

### Fase 2C: SDK (P3 ou P5) — Dias 10–12

#### TASK-22 · SDK `@stps/sdk`
**Responsável:** P3 ou P5 | **Tempo:** 4h | **Depende de:** TASK-10

```typescript
// packages/sdk/src/index.ts
export class StpsClient {
  async getScore(protocolAddress: string): Promise<TrustScoreResponse>
  async getHistory(protocolAddress: string): Promise<ScoreHistory[]>
  async getProtocols(): Promise<TrustScoreResponse[]>
}
```

**Entrega verificável:**
```typescript
// Deve funcionar com este código:
import { StpsClient } from "@stps/sdk";
const client = new StpsClient({ apiUrl: "http://localhost:3001" });
const score = await client.getScore("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
console.log(score.current_score); // 42
```

---

### ✅ Checkpoint Semana 2 (Dia 14)

- [ ] P1: Program ID na Devnet, testes passando
- [ ] P2: Webhook processando eventos reais do Helius
- [ ] P3: Score calculado em tempo real com L1+L2+L3; update on-chain funcionando
- [ ] P4: Dashboard com dados reais; página Drift animada e pronta
- [ ] P5: SDK funcional instalável localmente

**Demo interna:** P5 apresenta o pipeline completo ao time. Se alguma parte estiver quebrada, prioridade máxima para corrigir antes da Semana 3.

---

## 🚀 Semana 3 — Polimento e Entrega (Dias 15–21)

### Fase 3A: Estabilização (Dias 15–17)

#### TASK-23 · Testes de integração end-to-end
**Responsável:** P5 + P3 | **Tempo:** 4h

Escrever script `scripts/e2e-test.sh`:
```bash
#!/bin/bash
# 1. Registrar protocolo de teste
# 2. Enviar evento via webhook
# 3. Verificar score atualizado na API
# 4. Verificar score atualizado on-chain
echo "✅ Pipeline end-to-end OK"
```

---

#### TASK-24 · Tratamento de erros e edge cases
**Responsável:** Todos | **Tempo:** 3h

- P2: O que acontece se o Scoring Engine estiver fora? (retry com backoff)
- P3: O que acontece se DeFiLlama estiver fora? (fallback com cache)
- P4: O que acontece se a API retornar 500? (error boundary)

---

#### TASK-25 · Protocolos reais: Jupiter e Marinade
**Responsável:** P3 + P5 | **Tempo:** 3h

Registrar na Devnet e popular com dados reais (ou aproximados) de Jupiter e Marinade para o dashboard ter dados além do Drift.

**Endereços:**
- Jupiter: `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`
- Marinade: `MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD`

---

### Fase 3B: Documentação e Publicação (Dias 17–19)

#### TASK-26 · Publicar SDK no NPM
**Responsável:** P5 | **Tempo:** 2h | **Depende de:** TASK-22

```bash
cd packages/sdk
npm publish --access public --tag latest
```

**Entrega:** `npm install @stps/sdk` funciona de qualquer máquina.

---

#### TASK-27 · Deploy do frontend (Vercel)
**Responsável:** P4 | **Tempo:** 1h

```bash
vercel --prod
# Setar NEXT_PUBLIC_API_URL para a URL do Scoring Engine em produção
```

**Entrega:** URL pública do dashboard funcionando.

---

#### TASK-28 · README final
**Responsável:** P5 | **Tempo:** 2h

Atualizar `README.md` com:
- Program ID real da Devnet
- URL do dashboard publicado
- Badge de status
- `npm install @stps/sdk` com exemplo real

---

### Fase 3C: Vídeo de Pitch (Dias 19–21)

#### TASK-29 · Roteiro do vídeo (3–5 minutos)
**Responsável:** P5 | **Tempo:** 2h

```
[0:00–0:30] Problema: DeFi perdeu $3B em exploits. Ferramentas são reativas.
[0:30–1:00] Solução: STPS — Trust Score em tempo real, verificável on-chain.
[1:00–2:00] Demo ao vivo:
            - Abrir dashboard → mostrar Jupiter (100), Marinade (92)
            - Navegar para Drift → mostrar histórico com a queda 85→42
            - Abrir "/demo/drift" → timeline animada com o exploit
[2:00–2:30] SDK: 2 linhas de código para integrar em qualquer dApp
[2:30–3:00] On-chain: abrir Solana Explorer, mostrar o certificado na Devnet
[3:00–3:30] Durable Nonce Watchdog: diferencial único
[3:30–4:00] Próximos passos e call to action
```

---

#### TASK-30 · Gravação e submissão
**Responsável:** Todos | **Tempo:** 3h

- Gravar com OBS (resolução 1920x1080, 30fps)
- Narrador fala português com legendas em inglês (maior alcance)
- Fazer 2 takes, usar o melhor
- Submeter no portal do hackathon antes do deadline

---

### ✅ Checklist Final de Submissão

Antes de submeter, verificar **todos** os itens:

**Smart Contract**
- [ ] Deployado na Devnet com Program ID documentado
- [ ] IDL commitado em `target/idl/stps.json`
- [ ] Testes passando: `anchor test`

**Backend**
- [ ] Indexer processa eventos do Helius em < 2s
- [ ] Score calculado com L1 + L2 + L3 reais
- [ ] Update on-chain funcional com delta ≥ 5
- [ ] `GET /api/score/Drift_V2` retorna histórico correto

**Frontend**
- [ ] Dashboard acessível em URL pública (Vercel)
- [ ] Página Drift animada funcionando
- [ ] Mobile-responsive verificado em 375px

**SDK**
- [ ] `npm install @stps/sdk` funciona
- [ ] `getScore()` retorna em < 2s

**Repositório**
- [ ] Sem `.env` commitados (apenas `.env.example`)
- [ ] README com Program ID, URL do dashboard e exemplo do SDK
- [ ] Commits no padrão Conventional Commits

**Vídeo**
- [ ] 3–5 minutos
- [ ] Demo ao vivo (não slides estáticos)
- [ ] Mostra o caso Drift claramente

---

## 🚨 Plano de Contingência

Se o tempo apertar, seguir a ordem de corte:

| Prioridade | Feature | Impacto se cortada |
| :---: | :--- | :--- |
| 🔴 **Manter** | Caso Drift + dashboard | É o coração do pitch |
| 🔴 **Manter** | Update on-chain | Diferencial da "transparência" |
| 🔴 **Manter** | SDK `getScore()` | Prova o "2 linhas de código" |
| 🟡 **Simplificar** | L2 (DeFiLlama) | Pode usar dados hardcoded para a demo |
| 🟡 **Simplificar** | L3 (Nonce Watchdog) | Pode ser demonstrado com exemplo artificial |
| 🟠 **Cortar** | `WalletReputation` PDA | Funcionalidade secundária |
| 🟠 **Cortar** | `close_certificate` | Não afeta o demo |
| 🟠 **Cortar** | Protocolos Jupiter/Marinade reais | Usar dados mockados |

---

## 📅 Resumo por Dia

| Dia | P1 | P2 | P3 | P4 | P5 |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | Structs + state | Setup Express | Setup API | Setup Next.js | Setup monorepo |
| 2 | `register_protocol` | Parser Squads | Store + endpoints | Componentes base | Review + unblock |
| 3 | `update_score` | Parser Nonce | Seed Drift | Página principal | Review + unblock |
| 4 | `flag_alert` | Emitter | Cliente DeFiLlama | Página detalhe | Integração |
| 5 | Deploy Devnet | Teste webhook | L1 heurísticas | ScoreChart | IDL → SDK scaffold |
| 6 | Testes completos | Bug fixes | L2 heurísticas | Loading states | Checkpoint prep |
| 7 | **CHECKPOINT** | **CHECKPOINT** | **CHECKPOINT** | **CHECKPOINT** | **CHECKPOINT** |
| 8 | Buffer / bugs | Helius real | L3 heurísticas | Integração API | SDK types |
| 9 | — | — | Aggregator | Página Drift | SDK client |
| 10 | — | — | On-chain submit | Animação Drift | SDK publish prep |
| 11 | — | — | Testes E2E | Mobile fix | Deploy Vercel |
| 12 | — | — | Buffer | Bug fixes | Jupiter/Marinade |
| 13 | — | — | — | — | **DEMO INTERNA** |
| 14 | **CHECKPOINT** | **CHECKPOINT** | **CHECKPOINT** | **CHECKPOINT** | **CHECKPOINT** |
| 15 | — | — | Edge cases | Error boundaries | E2E tests |
| 16 | — | — | — | Empty states | README final |
| 17 | — | — | — | — | NPM publish |
| 18 | — | — | — | — | Roteiro pitch |
| 19 | — | — | — | — | Gravação take 1 |
| 20 | — | — | — | — | Gravação take 2 |
| 21 | **SUBMISSÃO** | **SUBMISSÃO** | **SUBMISSÃO** | **SUBMISSÃO** | **SUBMISSÃO** |
