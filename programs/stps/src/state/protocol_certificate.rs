use anchor_lang::prelude::*;
use crate::state::RiskLevel;

// ---------------------------------------------------------------------------
// Risk flag constants — bitmask positions in `risk_flags: u64`
// ---------------------------------------------------------------------------

/// Bit 0 — Timelock foi removido ou zerado
pub const FLAG_TIMELOCK_REMOVED: u64             = 1 << 0;
/// Bit 1 — Threshold do multisig foi reduzido
pub const FLAG_MULTISIG_THRESHOLD_LOWERED: u64   = 1 << 1;
/// Bit 2 — Novo signatário sem histórico adicionado
pub const FLAG_UNKNOWN_SIGNER_ADDED: u64         = 1 << 2;
/// Bit 3 — Chave de emergência usada sem timelock
pub const FLAG_EMERGENCY_KEY_USED: u64           = 1 << 3;
/// Bit 4 — Liquidez artificial (wash trading) detectada em colateral
pub const FLAG_WASH_TRADING_DETECTED: u64        = 1 << 4;
/// Bit 5 — Colateral com liquidez on-chain abaixo de $500k
pub const FLAG_LOW_LIQUIDITY_COLLATERAL: u64     = 1 << 5;
/// Bit 6 — Token de colateral criado há menos de 30 dias
pub const FLAG_NEW_TOKEN_COLLATERAL: u64         = 1 << 6;
/// Bit 7 — Top 10 wallets controlam mais de 60% do supply
pub const FLAG_HIGH_HOLDER_CONCENTRATION: u64    = 1 << 7;
/// Bit 8 — 1–2 nonce accounts admin com transação pendente
pub const FLAG_PENDING_ADMIN_NONCE: u64          = 1 << 8;
/// Bit 9 — 3+ nonce accounts admin com transações pendentes
pub const FLAG_MULTIPLE_ADMIN_NONCES: u64        = 1 << 9;

// ---------------------------------------------------------------------------
// ProtocolCertificate PDA
// Seeds: ["stps", "certificate", protocol_address.as_ref()]
// Size:  8 (discriminator) + 32 + 32 + 1 + 1 + 8 + 8 + 1 = 91 bytes
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct ProtocolCertificate {
    /// Scoring Authority — única Pubkey autorizada a atualizar este certificado.
    /// Definida no momento do registro e imutável após a criação.
    pub authority: Pubkey,          // 32 bytes

    /// Endereço on-chain do protocolo monitorado (ex: program ID do Drift).
    pub protocol_address: Pubkey,   // 32 bytes

    /// Trust Score atual: 0 (crítico) a 100 (totalmente confiável).
    pub trust_score: u8,            // 1 byte

    /// Nível de risco derivado do trust_score.
    /// Atualizado automaticamente sempre que trust_score muda.
    pub risk_level: RiskLevel,      // 1 byte

    /// Timestamp Unix (segundos) da última atualização do certificado.
    pub last_update: i64,           // 8 bytes

    /// Bitmask de 64 bits onde cada bit representa um evento de risco ativo.
    /// Use as constantes FLAG_* para ler e escrever flags individualmente.
    pub risk_flags: u64,            // 8 bytes

    /// Bump seed do PDA, armazenado para uso futuro em CPIs.
    pub bump: u8,                   // 1 byte
}
