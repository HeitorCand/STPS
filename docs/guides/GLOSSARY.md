# STPS — Glossário de Termos Técnicos

Este glossário define todos os termos técnicos utilizados na documentação e no código do STPS. Leia antes de contribuir com o projeto.

---

## A

### Anchor
Framework de desenvolvimento para smart contracts na Solana, escrito em Rust. Fornece macros que simplificam a criação de contas, validação de constraints e serialização de dados. Gera automaticamente um IDL (Interface Definition Language) que pode ser usado por clientes TypeScript via `@coral-xyz/anchor`.

**No STPS:** Todo o smart contract é escrito com Anchor. As macros `#[account]`, `#[program]`, `#[derive(Accounts)]` são usadas extensivamente.

---

## B

### Bitmask (Máscara de Bits)
Técnica para armazenar múltiplos valores booleanos em um único inteiro usando operações bitwise (AND, OR, XOR, bit shifts). Eficiente em espaço e compatível com operações atômicas.

**No STPS:** O campo `risk_flags: u64` da `ProtocolCertificate` usa um bitmask onde cada bit representa um evento de risco específico. Por exemplo, `risk_flags & FLAG_TIMELOCK_REMOVED != 0` verifica se o timelock foi removido.

```typescript
// Verificar se um flag está ativo
const timelockRemoved = (risk_flags & FLAG_TIMELOCK_REMOVED) !== 0n;

// Ativar um flag
risk_flags |= FLAG_TIMELOCK_REMOVED;

// Desativar um flag
risk_flags &= ~FLAG_TIMELOCK_REMOVED;
```

---

## C

### Collateral (Colateral)
Ativo depositado como garantia em protocolos DeFi de empréstimo ou lending (ex: Drift, Marginfi). Se o valor do colateral cair abaixo de um threshold, o protocolo pode liquidar a posição.

**No STPS:** A Camada 2 (L2) analisa a qualidade dos colaterais aceitos por cada protocolo. Colaterais com liquidez artificial, tokens novos ou alta concentração de holders recebem penalidades no Trust Score.

---

## D

### DeFiLlama
Plataforma de dados on-chain que agrega TVL (Total Value Locked), volumes de negociação, dados de tokens e métricas de liquidez de protocolos DeFi em diversas blockchains.

**No STPS:** Usado na Camada 2 (L2) para obter dados de liquidez e volume de tokens usados como colateral. A API é acessada com cache de 60 segundos.

**URL da API:** `https://api.llama.fi`

### Discriminator
8 bytes adicionados no início de toda conta Anchor como identificador do tipo de conta. Gerado como `sha256("account:NomeDoStruct")[0..8]`. Impede que dados de um tipo de conta sejam deserializados incorretamente como outro tipo.

**No STPS:** Ao calcular o tamanho de uma conta para `space`, sempre some +8: `8 + InitSpace`.

### Durable Nonce (Nonce Durável)
Mecanismo da Solana que permite criar transações que não expiram. Normalmente, transações Solana incluem um `recent_blockhash` que expira após ~120 segundos. Com durable nonces, o blockhash é substituído pelo hash armazenado em uma **nonce account**, que permanece válido até ser "avançado" (consumido).

**Por que é perigoso:** Um atacante ou insider pode pré-assinar uma transação maliciosa (ex: drenar fundos de um vault) e mantê-la válida por tempo indefinido. Quando o momento for oportuno, a transação é executada — sem que nenhum alerta seja gerado no momento da assinatura.

**No STPS:** A Camada 3 (L3) monitora nonce accounts associadas às admin keys de protocolos registrados. Uma nonce account com estado `initialized` e um nonce ativo indica transação pendente.

---

## G

### GovernanceEvent
Interface TypeScript normalizada que o Indexer cria após parsear uma transação de governança. É o "contrato" de dados entre o Indexer e o Scoring Engine.

```typescript
interface GovernanceEvent {
  type: "MULTISIG_THRESHOLD_CHANGED" | "TIMELOCK_CHANGED" | "SIGNER_ADDED" | ...;
  protocolAddress: string;
  sourceProgram: "squads" | "spl-governance" | "system-nonce";
  rawSignature: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}
```

---

## H

### Helius
Provedor de infraestrutura Solana especializado em webhooks de transações, RPC de alta performance e dados parsed (transações decodificadas). O SDK oficial é `helius-sdk`.

**No STPS:** O Indexer usa Helius Webhooks para receber notificações em tempo real quando transações relevantes (Squads, SPL Governance) são confirmadas na rede.

### Holder Concentration (Concentração de Holders)
Métrica que mede qual percentual do supply circulante de um token está nas mãos de um pequeno grupo de wallets. Alta concentração indica risco de manipulação de preço ou dump coordenado.

**No STPS:** Se as top 10 wallets controlam mais de 60% do supply de um token de colateral, o flag `FLAG_HIGH_HOLDER_CONCENTRATION` é ativado com penalidade de -12 pontos.

---

## I

### IDL (Interface Definition Language)
Arquivo JSON gerado pelo Anchor (`anchor build`) que descreve todas as instruções, contas, tipos e erros do smart contract. É equivalente a uma ABI no ecossistema EVM. Usado pelo SDK TypeScript para criar chamadas type-safe ao programa.

**No STPS:** O IDL fica em `target/idl/stps.json` após o build. É importado pelo `packages/sdk/` para tipagem e pelo `packages/scoring/` para submeter transações.

---

## L

### Lamport
Menor unidade da moeda nativa da Solana (SOL). `1 SOL = 1.000.000.000 lamports`. Transações e rent de contas são pagos em lamports.

### Layer (Camada)
Uma das três dimensões de análise do STPS:
- **L1 — Governance Intelligence:** analisa governança on-chain
- **L2 — Asset Legitimacy:** analisa qualidade de ativos/colaterais
- **L3 — Durable Nonce Watchdog:** analisa permissões latentes

---

## M

### Multisig
Carteira ou conta controlada por múltiplas chaves privadas que requer M de N assinaturas para aprovar uma transação (ex: 3 de 5 signatários). Usada em protocolos DeFi para distribuir controle e evitar pontos únicos de falha.

**No STPS:** A Camada 1 monitora multisigs de protocolos via o programa Squads. Mudanças no threshold (ex: 3/5 → 2/5) são detectadas e penalizam o Trust Score.

---

## N

### Nonce Account
Conta especial na Solana que armazena um nonce value para uso com durable nonces. Pertence a uma "nonce authority" que pode avançar (consumir) o nonce, invalidando quaisquer transações pendentes que o usavam. Uma nonce account com estado `initialized` indica que existe uma transação pré-assinada ativa.

---

## P

### PDA (Program Derived Address)
Endereço de conta na Solana que é derivado deterministicamente de seeds (strings/bytes) e de um Program ID. PDAs não têm chave privada associada — somente o programa que as criou pode assinar por elas.

**No STPS:** Cada `ProtocolCertificate` é um PDA com seeds `["stps", "certificate", protocol_address]`. Isso garante que existe no máximo um certificado por protocolo e que o endereço é previsível e verificável por qualquer cliente.

```typescript
// Derivar o PDA de um certificado
const [certificateAddress] = await PublicKey.findProgramAddress(
  [
    Buffer.from("stps"),
    Buffer.from("certificate"),
    protocolAddress.toBuffer(),
  ],
  programId
);
```

---

## R

### Rent (Aluguel)
Taxa paga em SOL para manter dados armazenados on-chain na Solana. Contas com saldo suficiente para cobrir 2 anos de rent são "rent-exempt" e ficam ativas indefinidamente. Quando uma conta é fechada, o rent é devolvido ao pagador original.

### RPC (Remote Procedure Call)
Interface para interagir com um nó da Solana. Permite consultar saldos, contas, transações, simular transações e submeter novas transações. O `@solana/web3.js` expõe métodos como `getAccountInfo`, `sendTransaction`, etc.

**No STPS:** O Scoring Engine usa um nó RPC Helius para consultar nonce accounts (L3) e submeter transações `update_score`.

### `risk_flags`
Campo `u64` da `ProtocolCertificate` que armazena, via bitmask, quais eventos de risco estão ativos para um protocolo. Cada bit corresponde a um flag específico. Ver [`SMART_CONTRACT.md`](../architecture/SMART_CONTRACT.md) para o mapa completo de bits.

---

## S

### Scoring Authority
Keypair (par de chaves) exclusivo que tem permissão para chamar as instruções `update_score`, `flag_alert` e `close_certificate` no programa Anchor STPS. Representa o Scoring Engine no contexto on-chain.

**Segurança crítica:** O segredo desta keypair (`SCORING_AUTHORITY_KEYPAIR`) deve existir **apenas** no ambiente do servidor do Scoring Engine. Nunca em código frontend, repositório git, ou logs.

### SPL Governance
Programa padrão da Solana para criar DAOs e sistemas de governança on-chain. Permite criar proposals, votar, e executar transações aprovadas via timelock.

**No STPS:** Um dos dois programas monitorados pelo Indexer (junto com Squads). Eventos como mudanças em configurações de governança são parseados pelo `packages/indexer/src/parsers/spl-governance.ts`.

**Program ID:** `GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw`

### Squads
Protocolo de multisig para Solana amplamente usado por DeFi protocols para gerenciar permissões administrativas. Permite criar multisigs com threshold configurável e timelocks.

**No STPS:** Principal fonte de eventos da Camada 1. O Indexer monitora transações enviadas ao programa Squads para detectar mudanças de threshold, adição/remoção de membros e uso de chaves de emergência.

**Program ID:** `SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu`

---

## T

### Timelock
Mecanismo de governança que adiciona um atraso obrigatório (ex: 24h, 72h) entre a aprovação de uma transação e sua execução. Dá tempo para a comunidade detectar transações maliciosas e cancelá-las antes de serem executadas.

**Por que é crítico:** Protocols sem timelock permitem que uma maioria do multisig execute ações instantaneamente — mesmo que maliciosas. A remoção do timelock é um dos sinais de risco mais sérios monitorados pelo STPS (penalidade: -30 pontos).

### Trust Score
Score de 0 a 100 atribuído a cada protocolo registrado no STPS. Representa o nível de confiança do protocolo com base em governança, qualidade de ativos e permissões latentes. Armazenado on-chain no `ProtocolCertificate` PDA.

| Score | Risk Level | Interpretação |
| :---: | :--- | :--- |
| 81–100 | Low 🟢 | Protocolo saudável |
| 61–80 | Medium 🟡 | Atenção necessária |
| 41–60 | High 🟠 | Reduzir exposição |
| 0–40 | Critical 🔴 | Saída urgente |

---

## W

### Wash Trading
Prática de comprar e vender o mesmo ativo entre carteiras controladas pelo mesmo grupo para criar volume artificial. Cria a ilusão de liquidez e demanda onde não existe de fato.

**No STPS:** Detectado na Camada 2 (L2) ao analisar o ratio entre volume total e volume suspeito (transações entre wallets clustered). Ratio > 0.7 ativa `FLAG_WASH_TRADING_DETECTED` com penalidade de -20 pontos.

### Webhook
Endpoint HTTP que recebe notificações em tempo real quando eventos ocorrem em um sistema externo. Em vez de fazer polling (consultar repetidamente), o sistema externo "empurra" os dados quando estão disponíveis.

**No STPS:** O Helius envia webhooks ao Indexer (`POST /webhook/governance`) toda vez que uma transação relevante é confirmada na Solana. Isso garante latência < 2 segundos da ocorrência on-chain até o processamento pelo Scoring Engine.
