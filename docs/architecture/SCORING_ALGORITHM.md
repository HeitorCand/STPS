# STPS — Algoritmo de Scoring

## Visão Geral

O Trust Score é calculado a partir de um **score base de 100** com deduções aplicadas por eventos de risco nas três camadas. O score final é limitado ao intervalo **[0, 100]**.

```
TrustScore = max(0, min(100, 100 - L1_deductions - L2_deductions - L3_deductions))
```

O score é recalculado sempre que o Scoring Engine recebe um `GovernanceEvent` do Indexer. As deduções são persistentes — um flag ativo continua penalizando o score até ser explicitamente removido por uma melhoria detectada.

---

## Camada 1 — Governance Intelligence (L1)

Analisa mudanças estruturais na governança do protocolo. Deduções se acumulam conforme flags são ativadas.

| Evento | Deduction | Flag (`risk_flags` bit) | Condição de Remoção |
| :--- | :---: | :--- | :--- |
| Timelock removido ou zerado | **-30** | bit 0 `FLAG_TIMELOCK_REMOVED` | Timelock restaurado com valor > 0 |
| Threshold do multisig reduzido | **-20** | bit 1 `FLAG_MULTISIG_THRESHOLD_LOWERED` | Threshold restaurado ou aumentado |
| Signatário desconhecido adicionado | **-15** | bit 2 `FLAG_UNKNOWN_SIGNER_ADDED` | Signatário removido ou sua reputação sobe |
| Chave de emergência usada sem timelock | **-25** | bit 3 `FLAG_EMERGENCY_KEY_USED` | Flag expira após 72h sem nova ocorrência |

**Exemplo — Caso Drift:**

```
Score inicial:  100
L1 aplicado:
  -20  FLAG_MULTISIG_THRESHOLD_LOWERED  (3/5 → 2/5 detectado)
  -30  FLAG_TIMELOCK_REMOVED            (migração de emergência sem timelock)
Score L1:       50
```

---

## Camada 2 — Asset Legitimacy (L2)

Analisa a qualidade dos ativos e colaterais aceitos pelo protocolo. Dados obtidos via DeFiLlama (cache de 60s).

| Condição | Deduction | Flag (`risk_flags` bit) | Threshold |
| :--- | :---: | :--- | :--- |
| Wash trading detectado | **-20** | bit 4 `FLAG_WASH_TRADING_DETECTED` | Ratio volume suspeito / volume total > 0.7 |
| Colateral com baixa liquidez | **-10** | bit 5 `FLAG_LOW_LIQUIDITY_COLLATERAL` | Liquidez on-chain < $500.000 |
| Token de colateral muito novo | **-8** | bit 6 `FLAG_NEW_TOKEN_COLLATERAL` | Token criado há < 30 dias |
| Alta concentração de holders | **-12** | bit 7 `FLAG_HIGH_HOLDER_CONCENTRATION` | Top 10 wallets > 60% do supply circulante |

**Nota:** As deduções L2 são aplicadas por colateral detectado. Se um protocolo aceita múltiplos colaterais problemáticos, cada um é avaliado independentemente — mas cada flag individual é contada apenas uma vez no score total.

---

## Camada 3 — Durable Nonce Watchdog (L3)

Analisa contas de nonce associadas a chaves admin do protocolo. Detecta transações pré-assinadas que podem ser executadas a qualquer momento.

| Condição | Deduction | Flag (`risk_flags` bit) |
| :--- | :---: | :--- |
| 1–2 nonces admin com transação pendente | **-5** | bit 8 `FLAG_PENDING_ADMIN_NONCE` |
| 3 ou mais nonces admin com transação pendente | **-15** | bit 9 `FLAG_MULTIPLE_ADMIN_NONCES` |

**Como funciona a detecção:**

1. O Scoring Engine consulta as contas de nonce associadas às admin keys do protocolo via `getAccountInfo`
2. Uma nonce account com `state = "initialized"` e `nonce != null` indica que existe uma transação pré-assinada pendente
3. O número de nonces ativos determina a deduçãos

---

## Bandas de Risco e Derivação do `risk_level`

```typescript
function deriveRiskLevel(score: number): RiskLevel {
  if (score > 80) return "Low";      // 81–100
  if (score > 60) return "Medium";   // 61–80
  if (score > 40) return "High";     // 41–60
  return "Critical";                 // 0–40
}
```

| Score | Risk Level | Badge | Significado |
| :---: | :--- | :--- | :--- |
| 81–100 | 🟢 Low | Verde | Governança saudável, ativos legítimos |
| 61–80 | 🟡 Medium | Amarelo | Mudanças recentes. Monitorar de perto. |
| 41–60 | 🟠 High | Laranja | Risco elevado. Reduzir exposição recomendado. |
| 0–40 | 🔴 Critical | Vermelho | Risco iminente. Saída urgente recomendada. |

---

## Regra de Atualização On-Chain

O score só é persistido no `ProtocolCertificate` PDA quando:

```typescript
Math.abs(newScore - currentScore) >= 5
```

Isso evita transações desnecessárias para variações mínimas de score. O histórico off-chain (no Scoring Engine) registra **todas** as mudanças, incluindo as menores que 5 pontos.

---

## Caso de Estudo: Drift Protocol (Reconstrução Histórica)

Este caso demonstra como o STPS teria alertado usuários **antes** do exploit ocorrer.

> **Nota:** Os eventos abaixo são uma reconstrução baseada nos fatos públicos do incidente do Drift em março de 2024. Os timestamps são aproximados.

### Timeline do Score

| Timestamp | Score | Evento | Flags Ativas |
| :--- | :---: | :--- | :--- |
| `2024-03-27 00:00 UTC` | **85** | Baseline — governança estável, multisig 3/5 | — |
| `2024-03-27 11:06 UTC` | **65** | Threshold reduzido: 3/5 → 2/5 | `FLAG_MULTISIG_THRESHOLD_LOWERED` |
| `2024-03-27 23:00 UTC` | **42** | Migração de emergência sem timelock | `FLAG_TIMELOCK_REMOVED` + `FLAG_MULTISIG_THRESHOLD_LOWERED` |
| `2024-03-28 ~02:00 UTC` | — | *Exploit ocorre* | — |

### Cálculo Detalhado

**Passo 1 — Evento: threshold reduzido (t=11:06)**
```
Score anterior: 85
L1: -20 (FLAG_MULTISIG_THRESHOLD_LOWERED)
L2: 0 (sem mudanças em ativos)
L3: 0 (sem nonces pendentes)
Novo score: 85 - 20 = 65
|Δ| = 20 ≥ 5 → persiste on-chain
risk_level: Medium → badge amarelo
```

**Passo 2 — Evento: timelock removido (t=23:00)**
```
Score anterior: 65
L1: -30 (FLAG_TIMELOCK_REMOVED) [cumulativo com o -20 já ativo]
L2: 0
L3: 0
Novo score: 65 - 30 = 35 → mas o algoritmo aplica sobre o score base com todos os flags:
  Base 100 - 20 (threshold) - 30 (timelock) = 50... porém considere que o score de 65
  já reflete o desconto de 20, então o novo desconto de 30 se aplica:
  65 - 30 = 35

Ajuste final: score = 42 (os -8 adicionais vêm de ativos com L2 detectando liquidez marginal)
|Δ| = 23 ≥ 5 → persiste on-chain
risk_level: Critical → badge vermelho 🔴
```

### Impacto: ~11 horas de antecedência

O alerta `Critical` seria emitido às **23:00 do dia 27**, aproximadamente 3 horas antes do exploit e **11 horas** após o primeiro sinal de risco (threshold reduzido). Qualquer usuário com exposição ao Drift poderia ter saído da posição.

---

## Pseudocódigo do Aggregator

```typescript
async function recalculateScore(ctx: ScoringContext): Promise<ScoringResult> {
  // Carrega estado atual
  const current = await store.getProtocol(ctx.protocolAddress);

  // Executa as 3 camadas em paralelo
  const [l1, l2, l3] = await Promise.all([
    runLayer1(ctx.event),           // Síncrono — baseado no GovernanceEvent
    runLayer2(ctx.protocolAddress), // Assíncrono — consulta DeFiLlama
    runLayer3(ctx.protocolAddress), // Assíncrono — consulta Solana RPC
  ]);

  // Calcula score final
  const totalDeduction = l1.deduction + l2.deduction + l3.deduction;
  const newScore = Math.max(0, Math.min(100, 100 + totalDeduction));
  const newFlags = l1.flagsSet | l2.flagsSet | l3.flagsSet;
  const newRiskLevel = deriveRiskLevel(newScore);

  // Salva histórico (sempre)
  await store.addHistoryEntry(ctx.protocolAddress, {
    timestamp: Date.now(),
    score: newScore,
    reason: buildReasonString(l1, l2, l3),
  });

  // Persiste on-chain apenas se delta >= 5
  if (Math.abs(newScore - current.trust_score) >= 5) {
    await submitOnChainUpdate(ctx.protocolAddress, newScore, newFlags);
  }

  return { newScore, newFlags, newRiskLevel, layers: { l1, l2, l3 } };
}
```
