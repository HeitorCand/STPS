# STPS — Quickstart (Indexer + Scoring Engine)

Guia mínimo para clonar o repo e ter o pipeline **Indexer → Scoring Engine**
rodando localmente em menos de 2 minutos. **Não requer** Anchor CLI, Solana CLI,
nem chave Helius — tudo funciona offline com eventos manuais.

Para o setup completo (smart contract on-chain, Helius webhook real, deploy)
veja [`SETUP.md`](SETUP.md).

---

## Pré-requisitos mínimos

| Ferramenta | Versão | Como instalar |
| :--- | :--- | :--- |
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) ou `nvm install 20` |
| pnpm | 8.15.9 | `corepack enable && corepack prepare pnpm@8.15.9 --activate` |

Verifica:

```bash
node --version    # v20.x ou superior
pnpm --version    # 8.15.9
```

---

## 1. Clonar e instalar

```bash
git clone https://github.com/your-org/STPS.git
cd STPS
pnpm install
```

## 2. Configurar `.env` dos dois pacotes

```bash
cp packages/indexer/.env.example packages/indexer/.env
cp packages/scoring/.env.example packages/scoring/.env
```

Os defaults já funcionam para dev local. Não precisa preencher nada.

| `.env` | Default seguro? | Observação |
| :--- | :---: | :--- |
| `packages/indexer/.env` | sim | `HELIUS_API_KEY` é placeholder; só importa para webhooks reais |
| `packages/scoring/.env` | sim | `DISABLE_ON_CHAIN=true` por default — não tenta escrever na Solana |

## 3. Build dos pacotes

```bash
pnpm build
```

## 4. Subir os dois servidores

Em **dois terminais separados**:

**Terminal 1 — Scoring Engine (porta 3001):**
```bash
pnpm dev:scoring
```

Saída esperada:
```json
{"event":"scoring_engine_started","port":3001,"on_chain_disabled":true}
```

**Terminal 2 — Indexer (porta 3000):**
```bash
pnpm dev:indexer
```

Saída esperada:
```json
{"event":"indexer_started","port":3000}
```

## 5. Disparar os 8 eventos de teste

**Terminal 3:**

```bash
# macOS / Linux
./packages/indexer/scripts/test-all-webhooks.sh

# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File .\packages\indexer\scripts\test-all-webhooks.ps1
```

## 6. Verificar o resultado

```bash
curl -s http://localhost:3001/api/protocols | jq
```

Resultado esperado para o protocolo Drift:

```json
{
  "count": 1,
  "protocols": [{
    "protocolAddress": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH",
    "currentScore": 25,
    "riskLevel": "Critical",
    "activeFlags": [
      "FLAG_TIMELOCK_REMOVED",
      "FLAG_MULTISIG_THRESHOLD_LOWERED",
      "FLAG_EMERGENCY_KEY_USED"
    ]
  }]
}
```

Se você vir `currentScore: 25` e `riskLevel: "Critical"`, **o pipeline está
funcionando corretamente** — o Caso Drift foi reproduzido em memória.

---

## Endpoints disponíveis

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET`  | `http://localhost:3000/health` | Health do Indexer |
| `POST` | `http://localhost:3000/webhook/governance` | Recebe webhooks Helius (raw) |
| `GET`  | `http://localhost:3001/health` | Health do Scoring Engine |
| `POST` | `http://localhost:3001/internal/event` | Recebe `GovernanceEvent` do Indexer |
| `GET`  | `http://localhost:3001/api/score/:protocol_id` | Detalhes do protocolo |
| `GET`  | `http://localhost:3001/api/protocols` | Lista todos os protocolos |
| `POST` | `http://localhost:3001/api/protocols/register` | Registra novo protocolo (chama on-chain se habilitado) |

---

## Próximos passos

Quando quiser ir além do dev local:

1. **Habilitar escrita on-chain** — gerar keypair, fazer airdrop devnet,
   `DISABLE_ON_CHAIN=false`. Veja [`SETUP.md`](SETUP.md#3-gerar-a-scoring-authority-keypair).

2. **Receber eventos reais da Helius** — preencher `HELIUS_API_KEY` no
   `.env` do Indexer e configurar webhook apontando para sua URL pública
   (Cloudflare Tunnel ou ngrok). Veja [`INDEXER.md`](../architecture/INDEXER.md#teste-com-helius).

3. **Integrar Frontend** — todas as rotas REST acima já estão prontas
   para consumo (ver [`DocTech.md`](../DocTech.md) seção 2.2).
