use anchor_lang::prelude::*;
use crate::state::{ProtocolCertificate, RiskLevel};
use crate::errors::StpsError;

// ---------------------------------------------------------------------------
// Instruction: update_score
// Atualiza trust_score, risk_flags e risk_level de um certificado existente.
// Somente a Scoring Authority original pode chamar esta instrução.
// ---------------------------------------------------------------------------

/// Atualiza o Trust Score e os risk_flags de um ProtocolCertificate.
/// Emite o evento ScoreUpdated após a mutação.
pub fn update_score(
    ctx: Context<UpdateScore>,
    new_score: u8,
    new_risk_flags: u64,
) -> Result<()> {
    require!(new_score <= 100, StpsError::InvalidScore);

    let certificate = &mut ctx.accounts.certificate;
    let clock = Clock::get()?;

    let old_score = certificate.trust_score;
    let old_flags = certificate.risk_flags;

    certificate.trust_score  = new_score;
    certificate.risk_flags   = new_risk_flags;
    certificate.risk_level   = RiskLevel::from_score(new_score);
    certificate.last_update  = clock.unix_timestamp;

    emit!(ScoreUpdated {
        protocol_address: certificate.protocol_address,
        old_score,
        new_score,
        old_flags,
        new_flags: new_risk_flags,
        risk_level: certificate.risk_level.clone(),
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Score updated: {} | {} -> {} | flags: {:#066b} | risk: {:?}",
        certificate.protocol_address,
        old_score,
        new_score,
        new_risk_flags,
        certificate.risk_level
    );

    Ok(())
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct UpdateScore<'info> {
    /// Deve ser a mesma authority registrada no certificado.
    /// Retorna StpsError::Unauthorized se não corresponder.
    #[account(
        constraint = authority.key() == certificate.authority @ StpsError::Unauthorized
    )]
    pub authority: Signer<'info>,

    /// ProtocolCertificate PDA a ser atualizado.
    #[account(
        mut,
        seeds = [b"stps", b"cert", certificate.protocol_address.as_ref()],
        bump = certificate.bump
    )]
    pub certificate: Account<'info, ProtocolCertificate>,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct ScoreUpdated {
    /// Endereço do protocolo cujo score foi atualizado.
    pub protocol_address: Pubkey,
    /// Score anterior à atualização.
    pub old_score: u8,
    /// Novo score após a atualização.
    pub new_score: u8,
    /// Bitmask de flags antes da atualização.
    pub old_flags: u64,
    /// Novo bitmask de flags após a atualização.
    pub new_flags: u64,
    /// Novo nível de risco derivado.
    pub risk_level: RiskLevel,
    /// Timestamp Unix da atualização.
    pub timestamp: i64,
}
