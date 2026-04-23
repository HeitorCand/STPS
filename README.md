# STPS — Solana Trust Protocol Standard

> **"O HTTPS tornou a internet segura e invisível. O STPS faz o mesmo para transações on-chain."**

O STPS é um protocolo de confiança para a rede Solana que atribui um **Trust Score (0–100)** a cada protocolo DeFi, calculado continuamente a partir de três camadas de análise: governança on-chain, legitimidade de ativos e permissões latentes via *durable nonces*. O score é registrado como um certificado verificável on-chain — análogo a um certificado TLS/HTTPS.

**O problema que resolve:** ferramentas atuais são reativas (analisam exploits após o fato). O STPS é proativo — teria alertado usuários do **Drift** com score caindo de 85 → 42 *antes* do exploit, ao detectar remoção de timelock e rebaixamento do threshold do multisig.

---

## Quick Start

```bash
# 1. Clonar e instalar dependências
git clone https://github.com/your-org/stps && cd stps
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com HELIUS_API_KEY, SCORING_AUTHORITY_KEYPAIR, etc.

# 3. Rodar todos os serviços localmente
pnpm dev
```

Para setup completo (Devnet deploy, Helius webhook, etc.) veja [`docs/guides/SETUP.md`](docs/guides/SETUP.md).

---

## SDK — Integração em 2 linhas

```bash
npm install @stps/sdk
```

```typescript
import { StpsClient } from "@stps/sdk";

const client = new StpsClient({ rpcUrl: "https://api.devnet.solana.com" });
const score = await client.getScore("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

console.log(score.current_score); // 42
console.log(score.risk_level);    // "High"
console.log(score.active_flags);  // ["FLAG_TIMELOCK_REMOVED", ...]
```

---

## Arquitetura

```
[Helius Webhooks] → [Indexer] → [Scoring Engine] → [Anchor Program]
                                                          ↓
                                              [Frontend Dashboard] + [SDK]
```

| Camada | Função |
| :--- | :--- |
| **L1 Governance Intelligence** | Monitora multisigs (Squads), timelocks e thresholds |
| **L2 Asset Legitimacy** | Detecta wash trading, colateral artificial e tokens novos |
| **L3 Durable Nonce Watchdog** | Detecta permissões latentes invisíveis em ferramentas comuns |

---

## Estrutura do Repositório

```
stps/
├── programs/stps/        # Smart Contract (Anchor/Rust)
├── packages/
│   ├── indexer/          # Helius Webhook listener (TypeScript)
│   ├── scoring/          # Scoring Engine API (TypeScript/Express)
│   └── sdk/              # SDK NPM público (TypeScript)
├── apps/dashboard/       # Frontend (Next.js 14)
└── docs/                 # Toda a documentação
```

---

## Documentação

| Documento | Descrição |
| :--- | :--- |
| [DesignDoc](docs/DesignDoc.md) | Visão do produto, arquitetura das 3 camadas, plano de execução |
| [DocTech](docs/DocTech.md) | Especificação técnica, schemas, API, DoD |
| [Arquitetura](docs/architecture/ARCHITECTURE.md) | Diagrama completo, decisões arquiteturais |
| [Algoritmo de Scoring](docs/architecture/SCORING_ALGORITHM.md) | Heurísticas, pesos e caso Drift |
| [Smart Contract Spec](docs/architecture/SMART_CONTRACT.md) | Instruções Anchor, contas, erros |
| [Setup Local](docs/guides/SETUP.md) | Pré-requisitos, env vars, deploy Devnet |
| [Glossário](docs/guides/GLOSSARY.md) | Termos técnicos definidos |

---

## Stack

| Componente | Tecnologia |
| :--- | :--- |
| Smart Contract | Anchor 0.29+ (Rust) |
| Indexer + Scoring Engine | TypeScript + Express |
| Frontend | Next.js 14 + Tailwind + Recharts |
| SDK | TypeScript (NPM) |
| Webhooks | Helius SDK |

---

## Equipe

| ID | Papel |
| :--- | :--- |
| P1 | Anchor Dev — Smart Contract |
| P2 | Indexer Dev — Helius Webhooks |
| P3 | Scoring Engine Dev — API + Heurísticas |
| P4 | Frontend Dev — Dashboard |
| P5 | Tech Lead — Arquitetura + Pitch |
