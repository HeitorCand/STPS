# STPS — As 3 Camadas de Análise de Risco

## Como o score é construído

O Trust Score começa em **100** e sofre **deduções** conforme riscos são detectados nas três camadas. O score final fica sempre entre 0 e 100.

```
Trust Score = max(0, min(100, 100 − L1 − L2 − L3))
```

As três camadas rodam **em paralelo** a cada evento recebido do Indexer, e seus resultados são somados pelo Aggregator.

---

## Camada 1 — Governance Intelligence (L1)

> **Pergunta:** *"Quem manda no protocolo mudou algo suspeito?"*

### O que monitora

O Indexer escuta transações dos programas **Squads** e **SPL Governance** via Helius Webhooks. Quando detecta uma mudança estrutural, envia um `GovernanceEvent` ao Scoring Engine. A L1 converte esse evento em uma dedução.

### Tabela de eventos e penalidades

| Evento recebido | O que aconteceu | Dedução | Flag ativada |
| :--- | :--- | :---: | :--- |
| `TIMELOCK_CHANGED` (remoção ou zero) | Protocolo removeu a janela de segurança que permite cancelar transações antes de executarem | **-30** | `FLAG_TIMELOCK_REMOVED` (bit 0) |
| `MULTISIG_THRESHOLD_CHANGED` (redução) | Quórum de aprovação reduzido, ex: 3/5 → 2/5 — menos pessoas precisam concordar | **-20** | `FLAG_MULTISIG_THRESHOLD_LOWERED` (bit 1) |
| `SIGNER_ADDED` (desconhecido) | Novo signatário sem histórico rastreável adicionado ao multisig | **-15** | `FLAG_UNKNOWN_SIGNER_ADDED` (bit 2) |
| `EMERGENCY_KEY_USED` | Chave de emergência usada para bypass do fluxo normal de governança | **-25** | `FLAG_EMERGENCY_KEY_USED` (bit 3) |

### Comportamento das flags

- Flags são **persistentes**: uma vez ativada, a dedução continua valendo até o risco ser revertido (ex: timelock restaurado apaga `FLAG_TIMELOCK_REMOVED`)
- Exceção: `FLAG_EMERGENCY_KEY_USED` **expira automaticamente após 72h** sem nova ocorrência
- Múltiplas flags se acumulam: é possível ter -30 + -20 = -50 pontos de L1 simultaneamente

### Exemplo — Caso Drift

```
Score inicial: 100

t=11:06  MULTISIG_THRESHOLD_CHANGED (3/5 → 2/5)
         L1: -20 → FLAG_MULTISIG_THRESHOLD_LOWERED ativada
         Score: 80 → badge Medium 🟡

t=23:00  TIMELOCK_CHANGED (emergência sem timelock)
         L1 acumulado: -20 -30 = -50 → FLAG_TIMELOCK_REMOVED ativada
         Score: 50 → badge High 🟠
```

---

## Camada 2 — Asset Legitimacy (L2)

> **Pergunta:** *"O dinheiro que o protocolo aceita como colateral é real?"*

### O que monitora

O Scoring Engine consulta a API do **DeFiLlama** para analisar os tokens aceitos pelo protocolo como colateral. A consulta usa **cache de 60 segundos** para evitar rate limit.

### Tabela de condições e penalidades

| Condição detectada | Significado | Dedução | Flag ativada | Threshold |
| :--- | :--- | :---: | :--- | :--- |
| Wash trading detectado | Volume de compra/venda entre mesmas wallets — liquidez artificial | **-20** | `FLAG_WASH_TRADING_DETECTED` (bit 4) | Volume suspeito > 70% do volume total |
| Baixa liquidez | Colateral difícil de liquidar em caso de crise | **-10** | `FLAG_LOW_LIQUIDITY_COLLATERAL` (bit 5) | Liquidez on-chain < $500.000 |
| Token muito novo | Histórico insuficiente para avaliar legitimidade | **-8** | `FLAG_NEW_TOKEN_COLLATERAL` (bit 6) | Token criado há < 30 dias |
| Alta concentração de holders | Poucos endereços controlam quase tudo — risco de dump coordenado | **-12** | `FLAG_HIGH_HOLDER_CONCENTRATION` (bit 7) | Top 10 wallets > 60% do supply circulante |

### Comportamento especial

- Cada flag é contada **uma única vez** no score total, mesmo que o protocolo aceite múltiplos colaterais problemáticos
- Se DeFiLlama estiver indisponível: mantém o último cache válido e **não aplica novas deduções** (fallback gracioso — não pune o protocolo por instabilidade externa)

---

## Camada 3 — Durable Nonce Watchdog (L3)

> **Pergunta:** *"Existe alguma transação pré-assinada escondida, pronta para executar a qualquer momento?"*

### Contexto: o que é um Durable Nonce

Na Solana, transações normalmente expiram em minutos. O recurso **Durable Nonce** permite pré-assinar uma transação que **não expira** — ela fica guardada em uma conta especial e pode ser executada dias ou meses depois, sem aviso.

Esse recurso tem **usos legítimos**: multisigs offline, custodians com hardware air-gapped, operações agendadas. Por isso, a L3 **não penaliza automaticamente** qualquer nonce pendente.

### Quando a L3 penaliza

A dedução só é aplicada se **pelo menos uma** das condições abaixo for verdadeira:

**Condição A — Governança já enfraquecida (flags L1 ativas)**
> O protocolo já tem timelock removido ou quórum reduzido. Nesse contexto, um nonce pendente deixa de ser operacional e passa a ser suspeito.

**Condição B — Transação de alto risco**
> A tx pré-assinada envolve permissões críticas: `upgrade authority`, `withdraw authority` ou `fee vault`. Mesmo com governança saudável, uma transação assim pendente é perigosa.

### Tabela de penalidades (quando contexto de risco confirmado)

| Situação | Dedução | Flag ativada |
| :--- | :---: | :--- |
| 1–2 nonces admin com transação pendente | **-5** | `FLAG_PENDING_ADMIN_NONCE` (bit 8) |
| 3 ou mais nonces admin com transação pendente | **-15** | `FLAG_MULTIPLE_ADMIN_NONCES` (bit 9) |

### Comportamento sem contexto de risco

Se o protocolo tem nonce pendente mas nenhuma condição de risco é confirmada (governança saudável + tx não envolve permissões críticas): o nonce é **registrado no histórico como `INFO`**, sem dedução.

### Como funciona a detecção

```
1. Scoring Engine identifica as admin keys do protocolo
2. Consulta o RPC da Solana: getAccountInfo para cada nonce account associada
3. Nonce account com state = "initialized" e nonce != null → tx pré-assinada pendente
4. Verifica se Condição A ou B é satisfeita
5. Aplica dedução (ou registra como INFO)
```

---

## Resultado final — Aggregator

Após as três camadas rodarem em paralelo, o Aggregator combina os resultados:

```typescript
const newScore = Math.max(0, Math.min(100, 100 + l1.deduction + l2.deduction + l3.deduction));
const newFlags = l1.flagsSet | l2.flagsSet | l3.flagsSet;
const riskLevel = deriveRiskLevel(newScore);
```

### Derivação do Risk Level

| Score | Risk Level | Badge | O que significa |
| :---: | :--- | :---: | :--- |
| 81–100 | Low | 🟢 | Governança saudável, ativos legítimos |
| 61–80 | Medium | 🟡 | Mudanças recentes. Monitorar de perto. |
| 41–60 | High | 🟠 | Risco elevado. Reduzir exposição recomendado. |
| 0–40 | Critical | 🔴 | Risco iminente. Saída urgente recomendada. |

### Regra de persistência on-chain

O score é gravado no `ProtocolCertificate` PDA **somente quando a variação for ≥ 5 pontos**:

```
|novo_score - score_atual| >= 5  →  submete update_score on-chain
```

Mudanças menores ficam apenas no histórico off-chain do Scoring Engine (usado para o gráfico do frontend). Isso evita transações desnecessárias e custo em lamports para variações insignificantes.

---

## Resumo visual

```
GovernanceEvent chega via POST /internal/event
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
  [L1]      [L2]      [L3]
Governança  DeFiLlama  Nonce RPC
(síncrono)  (60s cache) (contextual)
    │         │         │
    └─────────┼─────────┘
              ▼
         [Aggregator]
    score = 100 + L1 + L2 + L3
    flags = L1 | L2 | L3
    riskLevel = deriveRiskLevel(score)
              │
    ┌─────────┴─────────┐
    ▼                   ▼
Histórico off-chain   Se |Δ| >= 5:
(sempre salva)        update_score on-chain
```
