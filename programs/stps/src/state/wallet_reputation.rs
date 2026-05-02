use anchor_lang::prelude::*;

// ---------------------------------------------------------------------------
// WalletReputation PDA
// Seeds: ["stps", "wallet", wallet_address.as_ref()]
// Size:  8 (discriminator) + 32 + 1 + 1 + 1 + 8 + 8 + 1 = 60 bytes
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct WalletReputation {
    /// Endereço da carteira avaliada (tipicamente um signatário de multisig).
    pub wallet_address: Pubkey,     // 32 bytes

    /// Número de protocolos nos quais esta wallet é signatária ativa.
    pub protocol_count: u8,         // 1 byte

    /// Número de alertas de risco gerados a partir de ações desta wallet.
    /// Incrementado quando um evento de risco é atribuído a esta chave.
    pub risk_events: u8,            // 1 byte

    /// Reputação global: 0 (má reputação) a 100 (totalmente confiável).
    /// Calculado pelo Scoring Engine e gravado aqui pelo update_score.
    pub reputation_score: u8,       // 1 byte

    /// Timestamp Unix da primeira vez que esta wallet foi registrada.
    pub first_seen: i64,            // 8 bytes

    /// Timestamp Unix da última atualização desta conta.
    pub last_update: i64,           // 8 bytes

    /// Bump seed do PDA.
    pub bump: u8,                   // 1 byte
}
