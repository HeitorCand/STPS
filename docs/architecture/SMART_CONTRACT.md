# STPS — Smart Contract Specification

## Visão Geral

O programa Anchor STPS é o componente de armazenamento on-chain do Trust Score. Ele não calcula scores — apenas persiste o resultado calculado pelo Scoring Engine (off-chain) após validar a assinatura da Scoring Authority.

**Program ID (Devnet):** *(atualizar após o primeiro deploy)*

**IDL:** `target/idl/stps.json` (gerado por `anchor build`)

---

## Estrutura de Arquivos

```
programs/stps/src/
├── lib.rs                          # declare_id!, #[program] module
├── instructions/
│   ├── mod.rs
│   ├── register_protocol.rs
│   ├── update_score.rs
│   ├── flag_alert.rs
│   └── close_certificate.rs
├── state/
│   ├── mod.rs
│   ├── protocol_certificate.rs
│   ├── wallet_reputation.rs
│   └── risk_level.rs
└── errors.rs
```

---

## Contas (State)

### `ProtocolCertificate`

**PDA Seeds:** `["stps", "certificate", protocol_address.as_ref()]`

**Tamanho:** `8 + 32 + 32 + 1 + 1 + 8 + 8 + 1 = 91 bytes`

```rust
#[account]
#[derive(InitSpace)]
pub struct ProtocolCertificate {
    /// Scoring Authority — única Pubkey autorizada a atualizar este certificado
    pub authority: Pubkey,        // 32 bytes

    /// Endereço on-chain do protocolo monitorado
    pub protocol_address: Pubkey, // 32 bytes

    /// Trust Score de 0 a 100. Derivado pelo Scoring Engine.
    pub trust_score: u8,          // 1 byte

    /// Nível de risco derivado do trust_score
    pub risk_level: RiskLevel,    // 1 byte (enum u8)

    /// Unix timestamp (segundos) da última atualização
    pub last_update: i64,         // 8 bytes

    /// Bitmask de flags de risco ativos. Ver documentação de bits abaixo.
    pub risk_flags: u64,          // 8 bytes

    /// Bump seed do PDA para verificação
    pub bump: u8,                 // 1 byte
}
```

**Constantes de `risk_flags`:**

```rust
pub const FLAG_TIMELOCK_REMOVED: u64             = 1 << 0;  // bit 0
pub const FLAG_MULTISIG_THRESHOLD_LOWERED: u64   = 1 << 1;  // bit 1
pub const FLAG_UNKNOWN_SIGNER_ADDED: u64         = 1 << 2;  // bit 2
pub const FLAG_EMERGENCY_KEY_USED: u64           = 1 << 3;  // bit 3
pub const FLAG_WASH_TRADING_DETECTED: u64        = 1 << 4;  // bit 4
pub const FLAG_LOW_LIQUIDITY_COLLATERAL: u64     = 1 << 5;  // bit 5
pub const FLAG_NEW_TOKEN_COLLATERAL: u64         = 1 << 6;  // bit 6
pub const FLAG_HIGH_HOLDER_CONCENTRATION: u64    = 1 << 7;  // bit 7
pub const FLAG_PENDING_ADMIN_NONCE: u64          = 1 << 8;  // bit 8
pub const FLAG_MULTIPLE_ADMIN_NONCES: u64        = 1 << 9;  // bit 9
```

### `WalletReputation`

**PDA Seeds:** `["stps", "wallet", wallet_address.as_ref()]`

**Tamanho:** `8 + 32 + 1 + 1 + 1 + 8 + 8 + 1 = 60 bytes`

```rust
#[account]
#[derive(InitSpace)]
pub struct WalletReputation {
    /// Endereço da carteira avaliada (tipicamente um signatário de multisig)
    pub wallet_address: Pubkey,   // 32 bytes

    /// Score de reputação de 0 a 100
    pub reputation_score: u8,     // 1 byte

    /// Número de protocolos onde esta wallet é signatária ativa
    pub protocols_signed: u8,     // 1 byte

    /// Número de exploits ou incidentes associados a esta wallet
    pub incidents_count: u8,      // 1 byte

    /// Unix timestamp da primeira atividade indexada
    pub first_seen: i64,          // 8 bytes

    /// Unix timestamp da última atividade registrada
    pub last_seen: i64,           // 8 bytes

    /// Bump seed do PDA
    pub bump: u8,                 // 1 byte
}
```

### `RiskLevel` Enum

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum RiskLevel {
    Low,      // trust_score 81–100
    Medium,   // trust_score 61–80
    High,     // trust_score 41–60
    Critical, // trust_score 0–40
}

impl RiskLevel {
    pub fn from_score(score: u8) -> Self {
        match score {
            81..=100 => RiskLevel::Low,
            61..=80  => RiskLevel::Medium,
            41..=60  => RiskLevel::High,
            _        => RiskLevel::Critical,
        }
    }
}
```

---

## Instruções

### 1. `register_protocol`

Cria um novo `ProtocolCertificate` PDA para um protocolo.

**Quem pode chamar:** Qualquer conta (o `authority` passado se torna o dono do certificado). Na prática, apenas o Scoring Engine deve chamar.

**Contas:**

| Nome | Tipo | Mutável | Signer | Descrição |
| :--- | :--- | :---: | :---: | :--- |
| `authority` | `Signer` | ✓ | ✓ | Pagador do rent e dono do certificado |
| `certificate` | `Account<ProtocolCertificate>` | ✓ (init) | ✗ | PDA a ser criado |
| `system_program` | `Program<System>` | ✗ | ✗ | Necessário para criação de conta |

**Args:**

```rust
pub fn register_protocol(
    ctx: Context<RegisterProtocol>,
    protocol_address: Pubkey,
    initial_score: u8,
) -> Result<()>
```

**Constraints:**
- `initial_score <= 100` → `StpsError::InvalidScore`

**Lógica:**
```rust
let cert = &mut ctx.accounts.certificate;
cert.authority = ctx.accounts.authority.key();
cert.protocol_address = protocol_address;
cert.trust_score = initial_score;
cert.risk_level = RiskLevel::from_score(initial_score);
cert.last_update = Clock::get()?.unix_timestamp;
cert.risk_flags = 0;
cert.bump = ctx.bumps.certificate;
```

---

### 2. `update_score`

Atualiza o score, flags e risk_level de um certificado existente.

**Quem pode chamar:** Exclusivamente a Scoring Authority (keypair do Scoring Engine).

**Contas:**

| Nome | Tipo | Mutável | Signer | Descrição |
| :--- | :--- | :---: | :---: | :--- |
| `authority` | `Signer` | ✗ | ✓ | Deve ser a Scoring Authority |
| `certificate` | `Account<ProtocolCertificate>` | ✓ | ✗ | PDA a ser atualizado |

**Args:**

```rust
pub fn update_score(
    ctx: Context<UpdateScore>,
    new_score: u8,
    new_risk_flags: u64,
) -> Result<()>
```

**Constraints:**
- `authority.key() == certificate.authority` → `StpsError::Unauthorized`
- `new_score <= 100` → `StpsError::InvalidScore`

**Lógica:**
```rust
let cert = &mut ctx.accounts.certificate;
let old_score = cert.trust_score;
cert.trust_score = new_score;
cert.risk_flags = new_risk_flags;
cert.risk_level = RiskLevel::from_score(new_score);
cert.last_update = Clock::get()?.unix_timestamp;

emit!(ScoreUpdated {
    protocol_address: cert.protocol_address,
    old_score,
    new_score,
    risk_level: cert.risk_level.clone(),
    risk_flags: new_risk_flags,
    timestamp: cert.last_update,
});
```

---

### 3. `flag_alert`

Ativa bits específicos em `risk_flags` via operação OR — sem recalcular o score completo. Útil para alertas urgentes que precisam ser registrados antes do próximo ciclo de scoring.

**Quem pode chamar:** Exclusivamente a Scoring Authority.

**Contas:**

| Nome | Tipo | Mutável | Signer | Descrição |
| :--- | :--- | :---: | :---: | :--- |
| `authority` | `Signer` | ✗ | ✓ | Deve ser a Scoring Authority |
| `certificate` | `Account<ProtocolCertificate>` | ✓ | ✗ | PDA a ser atualizado |

**Args:**

```rust
pub fn flag_alert(
    ctx: Context<FlagAlert>,
    flag_bits: u64,
) -> Result<()>
```

**Lógica:**
```rust
let cert = &mut ctx.accounts.certificate;
cert.risk_flags |= flag_bits;  // OR — não sobrescreve flags existentes
cert.last_update = Clock::get()?.unix_timestamp;

emit!(AlertFlagged {
    protocol_address: cert.protocol_address,
    flag_bits,
    timestamp: cert.last_update,
});
```

---

### 4. `close_certificate`

Fecha o PDA e devolve o rent ao authority.

**Quem pode chamar:** Exclusivamente a Scoring Authority.

**Contas:**

| Nome | Tipo | Mutável | Signer | Descrição |
| :--- | :--- | :---: | :---: | :--- |
| `authority` | `Signer` | ✓ | ✓ | Recebe o rent devolvido |
| `certificate` | `Account<ProtocolCertificate>` | ✓ (close) | ✗ | PDA a ser fechado |
| `system_program` | `Program<System>` | ✗ | ✗ | Necessário para fechar conta |

**Constraints:**
- `authority.key() == certificate.authority` → `StpsError::Unauthorized`

---

## Eventos

```rust
#[event]
pub struct ScoreUpdated {
    pub protocol_address: Pubkey,
    pub old_score: u8,
    pub new_score: u8,
    pub risk_level: RiskLevel,
    pub risk_flags: u64,
    pub timestamp: i64,
}

#[event]
pub struct AlertFlagged {
    pub protocol_address: Pubkey,
    pub flag_bits: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolRegistered {
    pub protocol_address: Pubkey,
    pub authority: Pubkey,
    pub initial_score: u8,
    pub timestamp: i64,
}
```

---

## Erros

```rust
#[error_code]
pub enum StpsError {
    /// Signer is not the Scoring Authority for this certificate
    #[msg("Unauthorized: signer is not the Scoring Authority")]
    Unauthorized,

    /// Trust score must be between 0 and 100
    #[msg("Invalid score: must be between 0 and 100")]
    InvalidScore,

    /// This protocol address is already registered
    #[msg("Protocol already registered")]
    AlreadyRegistered,
}
```

---

## Deploy

```bash
# 1. Build e gerar IDL
anchor build

# 2. Rodar testes locais
anchor test

# 3. Deploy na Devnet
anchor deploy --provider.cluster devnet

# 4. Atualizar declare_id! em lib.rs com o novo Program ID
# 5. Atualizar ANCHOR_PROGRAM_ID no .env
# 6. Rebuild para atualizar o IDL com o novo ID
anchor build
```

---

## Cálculo de Tamanho das Contas

```rust
// ProtocolCertificate: 8 (discriminator) + InitSpace
// InitSpace = 32 + 32 + 1 + 1 + 8 + 8 + 1 = 83
// Total = 91 bytes

// WalletReputation: 8 (discriminator) + InitSpace
// InitSpace = 32 + 1 + 1 + 1 + 8 + 8 + 1 = 52
// Total = 60 bytes
```
