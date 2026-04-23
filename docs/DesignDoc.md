
# STPS — Solana Trust Protocol Standard

> **"O HTTPS tornou a internet segura e invisível. O STPS faz o mesmo para transações on-chain."**

---

## 1. O Problema

O ecossistema DeFi perdeu mais de **$3 bilhões em exploits** apenas em 2023–2024. A grande maioria desses incidentes **não foi causada por falhas de código**, mas por mudanças silenciosas de governança: remoção de timelocks, rebaixamento de thresholds em multisigs, e transações pré-assinadas com nonces duráveis que ficam "dormindo" por dias antes de serem executadas.

As ferramentas existentes são **reativas**: análise forense pós-exploit. Não existe um padrão de segurança *proativo* que avise usuários e integradores *antes* de o dinheiro ser movido.

**O STPS resolve isso.**

---

## 2. A Solução: Trust Score Dinâmico

O STPS atribui um **Trust Score** (0–100) a cada protocolo registrado na rede Solana. Esse score é calculado continuamente com base em três dimensões de risco e registrado on-chain como um certificado verificável — análogo a um certificado TLS/HTTPS.

### Bandas de Risco

| Score | Nível | Significado para o Usuário |
| :---: | :--- | :--- |
| 81–100 | 🟢 **Low** | Protocolo com governança saudável e ativos legítimos |
| 61–80 | 🟡 **Medium** | Mudanças recentes merecem atenção. Monitore. |
| 41–60 | 🟠 **High** | Risco elevado. Reduzir exposição recomendado. |
| 0–40 | 🔴 **Critical** | Risco iminente. Alertas ativos. Saída urgente. |

Veja o algoritmo completo em [`docs/architecture/SCORING_ALGORITHM.md`](architecture/SCORING_ALGORITHM.md).

---

## 3. Arquitetura do "Sistema Imune" — 3 Camadas

```
┌─────────────────────────────────────────────────────────────────┐
│                        STPS PIPELINE                            │
│                                                                 │
│  [Solana Network]                                               │
│       │                                                         │
│       ▼                                                         │
│  [Camada 1: Governance Intelligence]  ←── Squads / SPL Gov     │
│  [Camada 2: Asset Legitimacy]         ←── DeFiLlama / On-chain  │
│  [Camada 3: Durable Nonce Watchdog]   ←── Nonce Accounts       │
│       │                                                         │
│       ▼                                                         │
│  [Scoring Engine]  ──►  [Anchor Program (Devnet/Mainnet)]      │
│                                  │                              │
│                          [Frontend / SDK]                       │
└─────────────────────────────────────────────────────────────────┘
```

### Camada 1: Governance Intelligence (On-chain)

> **O quê**: Monitoramento contínuo de mudanças em estruturas de governança de protocolos.

* **Mecânica**: Um indexador (Helius Webhooks) escuta transações enviadas aos programas **Squads** (multisig) e **SPL Governance**. A cada mudança detectada, o payload é enviado ao Scoring Engine para reavaliação.
* **Indicadores de risco monitorados**:
  * ❌ Remoção ou redução de *timelocks* (janela de cancelamento de transações)
  * ❌ Redução do threshold de aprovação de um multisig (ex: 3/5 → 2/5)
  * ❌ Adição de signatários desconhecidos ou de baixa reputação
  * ❌ Uso de chaves "emergency" sem passagem por timelock
* **Exemplo real — Caso Drift**:
  O Conselho de Segurança do Drift migrou para um modelo **2/5** com **timelock zero** dias antes do exploit. O STPS teria derrubado o score de **85 → 42** ao detectar essa mudança, emitindo um alerta `Critical` *antes* de qualquer perda de capital.

### Camada 2: Asset Legitimacy Scoring (IA + On-chain)

> **O quê**: Análise da qualidade e legitimidade dos ativos e colaterais aceitos por um protocolo.

* **Mecânica**: O Scoring Engine cruza dados on-chain com a API do DeFiLlama para avaliar cada ativo aceito como colateral.
* **Métricas analisadas**:
  * 📊 **Liquidez Real vs. Wash Trading**: Razão entre volume real e volume suspeito (ciclos de compra/venda dentro do mesmo wallet cluster)
  * 📅 **Idade do Token**: Tokens com < 30 dias recebem penalidade automática
  * 👥 **Concentração de Holders**: Se top 10 wallets controlam > 60% do supply, é um sinal de risco
  * 🏦 **Colateral Inflado**: Detecta tokens usados como colateral com liquidez artificial (ex: CarbonVote Token)

### Camada 3: Durable Nonce Watchdog ⚡ Inovação

> **O quê**: Detecta *permissões latentes* em transações pré-assinadas — uma categoria de risco invisível para ferramentas convencionais.

* **Por que é único**: Transações Solana normalmente expiram se não confirmadas. Com **Durable Nonces**, uma transação pode ser pré-assinada e ficar válida indefinidamente. Um atacante (ou insider) pode pré-assinar uma transação de drenagem de fundos que só será executada no momento oportuno — sem que nenhum alerta seja disparado pelos monitores tradicionais.
* **Mecânica**: O STPS indexa todas as contas de *nonce* associadas a programas de governança e admin keys de protocolos registrados. Qualquer nonce account com uma transação pendente envolvendo permissões administrativas (upgrade authority, withdraw authority, fee vault) gera um flag `L3_PENDING_ADMIN_NONCE`.

---

## 4. Diferencial Competitivo

| Solução | Abordagem | Limitação |
| :--- | :--- | :--- |
| **DeFiSafety** | Auditoria manual periódica | Não é em tempo real; não detecta mudanças pós-auditoria |
| **Hypernative** | Monitoramento de anomalias on-chain | Foco em ataques em andamento, não em risco de governança preventivo |
| **Cybers / Blowfish** | Simulação de transação individual | Não avalia o protocolo como um todo nem durable nonces |
| **STPS** | Trust Score contínuo + certificado on-chain + Durable Nonce Watchdog | — |

**O STPS é o único protocolo que combina**: (1) score on-chain verificável, (2) monitoramento de governança em tempo real, e (3) detecção de permissões latentes via durable nonces.

---

## 5. Stack Tecnológico

| Componente | Tecnologia | Justificativa |
| :--- | :--- | :--- |
| **Smart Contract** | Anchor 0.29+ (Rust) | Padrão de fato da Solana; IDL gerado automaticamente facilita integração do SDK |
| **Indexer** | TypeScript + Helius SDK | Melhor SDK para Solana com suporte nativo a webhooks e parsed transactions |
| **Scoring Engine** | TypeScript + Express | Mesma stack do indexer — evita overhead de manter dois runtimes. Integra heurísticas + IA |
| **Frontend** | Next.js 14 + Tailwind + Recharts | App Router para SSR; Recharts para gráficos históricos do score |
| **SDK** | TypeScript (publicado no NPM) | Permite integração em qualquer dApp com 2 linhas de código |
| **IA (Roadmap)** | Claude API | MVP usa heurísticas puras; IA entra como camada de análise semântica de governança |

---

## 6. Plano de Execução — Sprint de 3 Semanas

### Semana 1: Fundação e Core Dev
* **Objetivo**: Deploy do programa na Devnet e integração básica end-to-end.
* **Entregáveis**:
  * Programa Anchor deployado na Devnet com instruções `register_protocol` e `update_score`
  * Structs `ProtocolCertificate` e `WalletReputation` como PDAs
  * Scoring Engine retornando scores via `GET /api/score/:protocol_id`
  * Indexer recebendo eventos do Helius e atualizando scores
* **Responsável**: P1 (Smart Contract) + P2/P3 (Indexer + Scoring Engine)

### Semana 2: O "Demo Killer" — Drift Case Study
* **Objetivo**: Construir a prova de conceito definitiva usando dados históricos reais.
* **Entregáveis**:
  * Timeline interativa mostrando o Trust Score do Drift caindo de **85 → 42** com os eventos mapeados
  * Componente de alerta visual com badge de risco colorido (🟢🟡🟠🔴)
  * Visualização histórica do score com anotações de eventos (ex: "Timelock removido")
* **Responsável**: P4 (Frontend) + P3 (dados históricos do Scoring Engine)

### Semana 3: Polimento e Entrega
* **Objetivo**: Estabilização, SDK publicada e vídeo de pitch gravado.
* **Entregáveis**:
  * SDK `@stps/sdk` publicada no NPM com método `getScore(protocolAddress)` funcional
  * Dashboard com scores reais de Jupiter e Marinade
  * Vídeo de pitch de 3–5 minutos demonstrando o caso Drift
  * Repositório organizado com README, docs e testes
* **Responsável**: Todos (P5 como Tech Lead coordenando)

---

## 7. Equipe

| ID | Papel | Responsabilidade Principal |
| :--- | :--- | :--- |
| **P1** | Anchor Dev | Smart Contract: instruções, PDAs, testes, IDL |
| **P2** | Indexer Dev | Helius Webhooks, ingestão de eventos de governança |
| **P3** | Scoring Engine Dev | API REST, heurísticas de cálculo, integração DeFiLlama |
| **P4** | Frontend Dev | Dashboard Next.js, componentes de alerta, timeline Drift |
| **P5** | Tech Lead | Arquitetura, integração entre componentes, pitch e docs finais |

---

## 8. Critérios de Sucesso

1. **Dashboard Funcional**: Scores reais de Jupiter e Marinade exibidos no frontend com histórico gráfico.
2. **Transparência On-chain**: Scores e alertas registrados via programa Anchor na Devnet e verificáveis por qualquer um.
3. **SDK Pronta para Uso**: `npm install @stps/sdk` + 2 linhas de código para integrar o Trust Score em qualquer dApp.
4. **Impacto Visual**: Timeline do caso Drift mostrando que o sistema teria alertado usuários **antes** da perda de capital.
5. **Durable Nonce Demo**: Pelo menos um exemplo funcional de detecção de nonce admin pendente via Camada 3.

---

## 9. Links de Referência

* 📐 Arquitetura detalhada: [`docs/architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md)
* 🧮 Algoritmo de Scoring: [`docs/architecture/SCORING_ALGORITHM.md`](architecture/SCORING_ALGORITHM.md)
* 📜 Smart Contract Spec: [`docs/architecture/SMART_CONTRACT.md`](architecture/SMART_CONTRACT.md)
* 🛠️ Setup local: [`docs/guides/SETUP.md`](guides/SETUP.md)
* 📖 Glossário: [`docs/guides/GLOSSARY.md`](guides/GLOSSARY.md)
* 📘 Especificação Técnica: [`docs/DocTech.md`](DocTech.md)