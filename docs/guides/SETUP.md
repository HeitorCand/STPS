# STPS — Setup Local e Deploy

## Pré-requisitos

Certifique-se de ter as seguintes ferramentas instaladas:

| Ferramenta | Versão Mínima | Instalação |
| :--- | :--- | :--- |
| Node.js | 20.x LTS | [nodejs.org](https://nodejs.org) ou `nvm install 20` |
| pnpm | 8.x | `npm install -g pnpm` |
| Rust | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Solana CLI | 1.18+ | [solana.com/docs/intro/installation](https://solana.com/docs/intro/installation) |
| Anchor CLI | 0.29+ | `cargo install --git https://github.com/coral-xyz/anchor avm --locked && avm install 0.29.0 && avm use 0.29.0` |

Verifique as instalações:

```bash
node --version      # v20.x.x
pnpm --version      # 8.x.x
rustc --version     # rustc 1.75+
solana --version    # solana-cli 1.18+
anchor --version    # anchor-cli 0.29+
```

---

## 1. Clonar e Instalar Dependências

```bash
git clone https://github.com/your-org/stps.git
cd stps
pnpm install
```

---

## 2. Configurar Variáveis de Ambiente

Copie os arquivos de exemplo e preencha com seus valores:

```bash
# Indexer
cp packages/indexer/.env.example packages/indexer/.env

# Scoring Engine
cp packages/scoring/.env.example packages/scoring/.env

# Frontend
cp apps/dashboard/.env.example apps/dashboard/.env.local
```

### `packages/indexer/.env`

```bash
PORT=3000
SCORING_ENGINE_URL=http://localhost:3001
HELIUS_API_KEY=your_helius_api_key_here
```

### `packages/scoring/.env`

```bash
PORT=3001
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=your_key_here
ANCHOR_PROGRAM_ID=<será preenchido após o deploy>
SCORING_AUTHORITY_KEYPAIR=[1,2,3,...]   # JSON byte array — ver seção abaixo
DEFI_LLAMA_BASE_URL=https://api.llama.fi
```

### `apps/dashboard/.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 3. Gerar a Scoring Authority Keypair

A Scoring Authority é a única conta que pode assinar transações `update_score` no contrato. Gere uma keypair dedicada para isso:

```bash
# Gerar keypair
solana-keygen new --outfile ~/.config/stps/scoring-authority.json --no-bip39-passphrase

# Obter o array de bytes para o .env
node -e "
const fs = require('fs');
const kp = JSON.parse(fs.readFileSync(process.env.HOME + '/.config/stps/scoring-authority.json'));
console.log(JSON.stringify(kp));
"
```

Cole o output no campo `SCORING_AUTHORITY_KEYPAIR` do `.env` do Scoring Engine.

> ⚠️ **NUNCA** commite este arquivo. Ele já está no `.gitignore`.

---

## 4. Configurar a Solana CLI para Devnet

```bash
solana config set --url devnet

# Verificar configuração
solana config get

# Criar uma carteira local (se ainda não tiver)
solana-keygen new --outfile ~/.config/solana/id.json

# Obter SOL de devnet para pagar transações de deploy
solana airdrop 2
solana balance
```

---

## 5. Build e Deploy do Smart Contract

```bash
# Build
anchor build

# Testes locais (sobe um validator local automaticamente)
anchor test

# Deploy na Devnet
anchor deploy --provider.cluster devnet
```

Após o deploy, o output mostrará o Program ID. Atualize:

1. `declare_id!("SEU_PROGRAM_ID");` em `programs/stps/src/lib.rs`
2. `ANCHOR_PROGRAM_ID=SEU_PROGRAM_ID` em `packages/scoring/.env`

Depois, rebuildasse para o IDL refletir o novo ID:

```bash
anchor build
```

---

## 6. Rodar os Serviços Localmente

Abra 3 terminais:

**Terminal 1 — Indexer:**
```bash
cd packages/indexer
pnpm dev
# Listening on http://localhost:3000
```

**Terminal 2 — Scoring Engine:**
```bash
cd packages/scoring
pnpm dev
# Listening on http://localhost:3001
```

**Terminal 3 — Frontend:**
```bash
cd apps/dashboard
pnpm dev
# Open http://localhost:3002
```

Ou rode tudo de uma vez da raiz:
```bash
pnpm dev   # Turborepo roda todos em paralelo
```

---

## 7. Configurar Helius Webhook

1. Acesse [dashboard.helius.dev](https://dashboard.helius.dev) e crie uma conta
2. Vá em **Webhooks → Create Webhook**
3. Configure:
   - **URL:** `https://seu-ngrok-ou-deploy.url/webhook/governance`
   - **Transaction Types:** `Any`
   - **Account Addresses:** adicione os Program IDs que deseja monitorar:
     - Squads Multisig: `SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu5`
     - SPL Governance: `GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw`
4. Salve e copie a API key para `HELIUS_API_KEY` no `.env` do Indexer

**Para desenvolvimento local**, use [ngrok](https://ngrok.com) para expor o Indexer:

```bash
ngrok http 3000
# Use a URL gerada como Webhook URL no dashboard Helius
```

---

## 8. Testar o Pipeline Manualmente

Com todos os serviços rodando, teste o pipeline completo:

```bash
# 1. Registrar um protocolo de teste via Scoring Engine
curl -X POST http://localhost:3001/api/protocols/register \
  -H "Content-Type: application/json" \
  -d '{"protocol_address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH", "initial_score": 85}'

# 2. Verificar o score
curl http://localhost:3001/api/score/Drift_V2

# 3. Simular um evento de governança
curl -X POST http://localhost:3000/webhook/governance \
  -H "Content-Type: application/json" \
  -d '{
    "type": "GOVERNANCE",
    "instructions": [{"programId": "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu5"}],
    "signature": "test123",
    "timestamp": 1711540000
  }'

# 4. Verificar se o score foi atualizado
curl http://localhost:3001/api/score/Drift_V2
```

---

## 9. Estrutura dos `.env.example`

Crie os seguintes arquivos `.env.example` no repositório (commitar estes):

**`packages/indexer/.env.example`:**
```bash
PORT=3000
SCORING_ENGINE_URL=http://localhost:3001
HELIUS_API_KEY=your_helius_api_key_here
```

**`packages/scoring/.env.example`:**
```bash
PORT=3001
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
ANCHOR_PROGRAM_ID=PROGRAM_ID_AFTER_DEPLOY
SCORING_AUTHORITY_KEYPAIR=REPLACE_WITH_JSON_BYTE_ARRAY
DEFI_LLAMA_BASE_URL=https://api.llama.fi
```

**`apps/dashboard/.env.example`:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Troubleshooting

### `anchor build` falha com erro de versão do Rust

```bash
rustup update stable
rustup default stable
```

### `anchor deploy` falha com "insufficient funds"

```bash
solana airdrop 2
solana balance
```

### Helius webhook não está chegando localmente

Verifique se o ngrok está rodando e se a URL no dashboard Helius está atualizada. O ngrok cria uma nova URL a cada restart.

### Score não está atualizando on-chain

Verifique:
1. `ANCHOR_PROGRAM_ID` está correto no `.env`
2. `SCORING_AUTHORITY_KEYPAIR` é o mesmo keypair que foi declarado como authority no `register_protocol`
3. A variação do score é `≥ 5` pontos
4. O Scoring Engine tem SOL para pagar a transação (verificar endereço da authority)
