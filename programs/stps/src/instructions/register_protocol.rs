use anchor_lang::prelude::*;
use crate::state::{ProtocolCertificate, RiskLevel};
use crate::errors::StpsError;

// ---------------------------------------------------------------------------
// Instruction: register_protocol
// Cria um novo ProtocolCertificate PDA para um protocolo.
// Quem pode chamar: o Scoring Engine (authority = Scoring Authority keypair).
// ---------------------------------------------------------------------------

/// Registra um novo protocolo no STPS e cria o seu ProtocolCertificate PDA.
pub fn register_protocol(
    ctx: Context<RegisterProtocol>,
    protocol_address: Pubkey,
    initial_score: u8,
) -> Result<()> {
    require!(initial_score <= 100, StpsError::InvalidInitialScore);

    let certificate = &mut ctx.accounts.certificate;
    let clock = Clock::get()?;

    certificate.authority        = ctx.accounts.authority.key();
    certificate.protocol_address = protocol_address;
    certificate.trust_score      = initial_score;
    certificate.risk_level       = RiskLevel::from_score(initial_score);
    certificate.last_update      = clock.unix_timestamp;
    certificate.risk_flags       = 0;
    certificate.bump             = ctx.bumps.certificate;

    emit!(ProtocolRegistered {
        protocol_address,
        authority: certificate.authority,
        initial_score,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Protocol registered: {} | score: {} | risk: {:?}",
        protocol_address,
        initial_score,
        certificate.risk_level
    );

    Ok(())
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(protocol_address: Pubkey)]
pub struct RegisterProtocol<'info> {
    /// Scoring Authority — paga o rent e torna-se dono do certificado.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// ProtocolCertificate PDA a ser criado.
    /// Seeds: ["stps", "certificate", protocol_address]
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolCertificate::INIT_SPACE,
        seeds = [b"stps", b"cert", protocol_address.as_ref()],
        bump
    )]
    pub certificate: Account<'info, ProtocolCertificate>,

    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct ProtocolRegistered {
    /// Endereço do protocolo recém-registrado.
    pub protocol_address: Pubkey,
    /// Scoring Authority que criou o certificado.
    pub authority: Pubkey,
    /// Score inicial atribuído no momento do registro.
    pub initial_score: u8,
    /// Timestamp Unix do registro.
    pub timestamp: i64,
}
