
# 📘 Especificação Técnica: STPS Protocol

## 1. Padrões de Desenvolvimento

Para manter a qualidade do código sob pressão de hackathon:

* **Linguagem Principal:** TypeScript (Strict Mode) para todo Backend, Indexer, Frontend e SDK. **Não usar Python** — uma única runtime reduz overhead de configuração.
* **Smart Contract:** Anchor Framework v0.29+ (Rust). IDL gerado automaticamente pelo Anchor.
* **Versionamento:** Git Flow simplificado:
  * `main` — estável, aponta para o último deploy na Devnet
  * `develop` — branch de integração
  * `feature/<nome>` — funcionalidades individuais, PRs para `develop`
  * `hotfix/<nome>` — correções urgentes direto para `main` + merge em `develop`
* **Commits:** Padrão [Conventional Commits](https://www.conventionalcommits.org/):
  * `feat:` — nova funcionalidade
  * `fix:` — correção de bug
  * `docs:` — documentação apenas
  * `chore:` — configuração, deps
  * `test:` — testes

---

## 2. Arquitetura de Dados (Data Schema)

### 2.1. On-Chain (Solana PDAs)

O programa Anchor gerencia o estado global de confiança via duas PDAs principais.

#### `ProtocolCertificate` PDA

Seeds: `["stps", "certificate", protocol_address]`

```rust
#[account]
pub struct ProtocolCertificate {
    pub authority: Pubkey,         // Scoring Authority — única chave que pode atualizar
    pub protocol_address: Pubkey,  // Endereço do programa/protocolo monitorado
    pub trust_score: u8,           // 0–100. Thresholds: ≤40=Critical, ≤60=High, ≤80=Medium, >80=Low
    pub risk_level: RiskLevel,     // Enum derivado do trust_score
    pub last_update: i64,          // Unix timestamp da última atualização
    pub risk_flags: u64,           // Bitmask — ver mapa abaixo
    pub bump: u8,                  // PDA bump seed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RiskLevel {
    Low,      // score 81–100
    Medium,   // score 61–80
    High,     // score 41–60
    Critical, // score 0–40
}
```

#### Mapa do Bitmask `risk_flags` (u64)

Cada bit representa um evento de risco específico. Múltiplos flags podem estar ativos simultaneamente.

| Bit | Constante | Evento que Ativa |
| :--: | :--- | :--- |
| 0 | `FLAG_TIMELOCK_REMOVED` | Timelock foi removido ou zerado |
| 1 | `FLAG_MULTISIG_THRESHOLD_LOWERED` | Threshold do multisig foi reduzido |
| 2 | `FLAG_UNKNOWN_SIGNER_ADDED` | Novo signatário sem histórico adicionado |
| 3 | `FLAG_EMERGENCY_KEY_USED` | Chave de emergência usada sem timelock |
| 4 | `FLAG_WASH_TRADING_DETECTED` | Liquidez artificial detectada em colateral |
| 5 | `FLAG_LOW_LIQUIDITY_COLLATERAL` | Colateral com liquidez < $500k |
| 6 | `FLAG_NEW_TOKEN_COLLATERAL` | Token de colateral com < 30 dias de existência |
| 7 | `FLAG_HIGH_HOLDER_CONCENTRATION` | Top 10 wallets controlam > 60% do supply |
| 8 | `FLAG_PENDING_ADMIN_NONCE` | Nonce account admin com transação pendente |
| 9 | `FLAG_MULTIPLE_ADMIN_NONCES` | 3+ nonces admin pendentes simultaneamente |
| 10–63 | *(reservado)* | Uso futuro |

#### `WalletReputation` PDA

Seeds: `["stps", "wallet", wallet_address]`

```rust
#[account]
pub struct WalletReputation {
    pub wallet_address: Pubkey,    // Endereço da carteira/signer
    pub reputation_score: u8,      // 0–100. Afeta o score de protocolos onde é signatário
    pub protocols_signed: u8,      // Número de protocolos onde esta wallet é signatária
    pub incidents_count: u8,       // Número de exploits associados a esta wallet
    pub first_seen: i64,           // Unix timestamp da primeira transação indexada
    pub last_seen: i64,            // Unix timestamp da última atividade
    pub bump: u8,
}
```

### 2.2. API REST — Scoring Engine

**Base URL (dev):** `http://localhost:3001` | **Base URL (demo):** `https://api.stps.dev`

#### `GET /api/score/:protocol_id`

```json
{
  "protocol_id": "Drift_V2",
  "protocol_address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
  "current_score": 42,
  "risk_level": "High",
  "active_flags": ["FLAG_TIMELOCK_REMOVED", "FLAG_MULTISIG_THRESHOLD_LOWERED"],
  "history": [
    { "timestamp": 1711500000, "score": 85, "reason": "Baseline — governance healthy" },
    { "timestamp": 1711540000, "score": 65, "reason": "FLAG_MULTISIG_THRESHOLD_LOWERED: 3/5 → 2/5" },
    { "timestamp": 1711586400, "score": 42, "reason": "FLAG_TIMELOCK_REMOVED: emergency migration" }
  ],
  "layers": {
    "l1_governance": { "status": "Critical", "score_contribution": -43, "alerts": ["Emergency migration to 2/5 with zero timelock"] },
    "l2_assets":     { "status": "Healthy",  "score_contribution": 0,   "alerts": [] },
    "l3_nonces":     { "status": "Warning",  "score_contribution": 0,   "alerts": ["3 pending admin nonces detected"] }
  },
  "last_updated": 1711586400
}
```

**Outros endpoints:**

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/protocols` | Lista todos os protocolos registrados com scores |
| `POST` | `/api/protocols/register` | Registra novo protocolo (requer Scoring Authority) |
| `GET` | `/api/wallet/:address` | Retorna reputação de uma wallet signatária |
| `GET` | `/health` | Health check: `{ "status": "ok" }` |

---

## 3. Fluxo de Integração (Pipeline)

```
Helius Webhook  ──POST /webhook/governance──►  [Indexer]
                                                    │
                                     Normaliza GovernanceEvent
                                                    │
                                                    ▼
                                          [Scoring Engine]
                                          1. Carrega PDA atual
                                          2. Executa L1 + L2 + L3
                                          3. Calcula novo score
                                          4. Se |Δ| ≥ 5 → update_score
                                                    │
                                                    ▼
                                         [Anchor Program]
                                         Valida Scoring Authority
                                         Atualiza PDA + emite evento
                                                    │
                                          ┌─────────┴─────────┐
                                          ▼                   ▼
                                     [Frontend]             [SDK]
```

**Regra de threshold on-chain:** o score só é gravado on-chain se `|novo_score - score_atual| ≥ 5`. Isso evita sobrecarga de transações.

---

## 4. Estrutura do Monorepo

```
stps/
├── programs/stps/src/
│   ├── lib.rs                  # declare_id!, módulos, entry points
│   ├── instructions/           # register_protocol.rs, update_score.rs, flag_alert.rs
│   ├── state/                  # protocol_certificate.rs, wallet_reputation.rs
│   └── errors.rs               # StpsError enum
├── packages/
│   ├── indexer/src/
│   │   ├── index.ts            # Express server + /webhook/governance
│   │   ├── parsers/            # squads.ts, spl-governance.ts, nonce.ts
│   │   └── emitter.ts          # GovernanceEvent → Scoring Engine
│   ├── scoring/src/
│   │   ├── index.ts            # Express API routes
│   │   ├── engine/             # layer1.ts, layer2.ts, layer3.ts, aggregator.ts
│   │   ├── clients/            # defi-llama.ts, solana-rpc.ts
│   │   └── on-chain.ts         # Assina e envia update_score
│   └── sdk/src/
│       ├── index.ts            # getScore(), getHistory(), subscribeToAlerts()
│       └── types.ts            # TrustScore, RiskLevel, ScoreHistory, Alert
├── apps/dashboard/app/
│   ├── page.tsx                # Home: lista de protocolos
│   └── protocol/[id]/page.tsx  # Detalhe: histórico + alertas
├── docs/
└── .github/copilot-instructions.md

```

---

## 5. Definição de "Pronto" (DoD) por Componente

### 5.1. Smart Contract (P1)
* [ ] Comentários inline em cada instrução e campo das structs.
* [ ] Testes: `register_protocol` (sucesso + autoridade inválida), `update_score` (sucesso + delta < 5 + não autorizado), `flag_alert`, `close_certificate`.
* [ ] IDL gerado (`target/idl/stps.json`) commitado e validado pela SDK.
* [ ] `anchor deploy` funcional na Devnet com Program ID documentado no README.

### 5.2. Indexer (P2)
* [ ] Retry com backoff exponencial em falhas de RPC/Webhook.
* [ ] Logs estruturados (JSON) com `event_type`, `protocol_address`, `timestamp`.
* [ ] Processamento de eventos em **< 2 segundos** (p95).
* [ ] Endpoint `GET /health` operacional.

### 5.3. Scoring Engine (P3)
* [ ] Cache de 60 segundos para DeFiLlama (evitar rate limit).
* [ ] Log de cada cálculo: score antes/depois e flags ativadas.
* [ ] Validação de schema com `zod` em todos os endpoints.
* [ ] Fallback gracioso se DeFiLlama indisponível: mantém cache; não zera score.

### 5.4. Frontend (P4)
* [ ] Mobile-responsive com breakpoints Tailwind (sm/md/lg).
* [ ] Skeleton screens para estados de loading > 400ms.
* [ ] Empty state para protocolos não registrados.
* [ ] Gráfico histórico com `ReferenceLine` nos pontos de mudança de score.

---

## 6. Variáveis de Ambiente

| Variável | Componente | Descrição |
| :--- | :--- | :--- |
| `HELIUS_API_KEY` | Indexer | API key Helius (webhooks + RPC) |
| `SCORING_AUTHORITY_KEYPAIR` | Scoring Engine | Keypair JSON (array de bytes). **NUNCA commitar.** |
| `SOLANA_RPC_URL` | Scoring + SDK | URL do nó RPC Helius |
| `ANCHOR_PROGRAM_ID` | Todos | Program ID do contrato deployado |
| `DEFI_LLAMA_BASE_URL` | Scoring Engine | `https://api.llama.fi` |
| `NEXT_PUBLIC_API_URL` | Frontend | URL do Scoring Engine (acessível pelo browser) |

---

## 7. Segurança

* **Scoring Authority**: `SCORING_AUTHORITY_KEYPAIR` **nunca** deve ser exposta no frontend, commitada no repo ou transmitida sem TLS. Em produção: usar Doppler ou AWS Secrets Manager.
* **Validação On-chain**: O programa rejeita qualquer instrução sem assinatura da Scoring Authority com `StpsError::Unauthorized`.
* **Rate Limiting**: `/webhook/governance` deve ter limite de 100 req/min por IP via `express-rate-limit`.
* **Upgrade Authority**: Na Devnet pode ser o dev local. Na Mainnet deve ser transferida para multisig ou renunciada.

---

## 8. Performance

| Métrica | Target | Componente |
| :--- | :--- | :--- |
| Ingestão de evento (webhook → processado) | < 2s p95 | Indexer |
| Cálculo de score | < 500ms | Scoring Engine |
| Confirmação de tx on-chain | < 30s | Anchor + RPC |
| LCP do dashboard | < 3s | Frontend |
| TTL cache DeFiLlama | 60s | Scoring Engine |

---

## 9. Links

* 📐 Arquitetura: [`docs/architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md)
* 🧮 Algoritmo de Scoring: [`docs/architecture/SCORING_ALGORITHM.md`](architecture/SCORING_ALGORITHM.md)
* 📜 Smart Contract Spec: [`docs/architecture/SMART_CONTRACT.md`](architecture/SMART_CONTRACT.md)
* 🛠️ Setup local + deploy: [`docs/guides/SETUP.md`](guides/SETUP.md)
* 📖 Glossário: [`docs/guides/GLOSSARY.md`](guides/GLOSSARY.md)
