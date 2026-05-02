use anchor_lang::prelude::*;
use crate::state::ProtocolCertificate;
use crate::errors::StpsError;

// ---------------------------------------------------------------------------
// Instruction: flag_alert
// Ativa bits específicos no risk_flags sem recalcular o score completo.
// Útil para eventos urgentes que precisam ser registrados imediatamente.
// ---------------------------------------------------------------------------

/// Ativa um ou mais bits no campo risk_flags do ProtocolCertificate.
/// Operação: `certificate.risk_flags |= flag_bits`
/// Não altera o trust_score — use update_score para isso.
pub fn flag_alert(ctx: Context<FlagAlert>, flag_bits: u64) -> Result<()> {
    let certificate = &mut ctx.accounts.certificate;
    let clock = Clock::get()?;

    let old_flags = certificate.risk_flags;
    certificate.risk_flags |= flag_bits;
    certificate.last_update = clock.unix_timestamp;

    emit!(AlertFlagged {
        protocol_address: certificate.protocol_address,
        flag_bits,
        old_flags,
        new_flags: certificate.risk_flags,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Alert flagged: {} | bits set: {:#066b} | total flags: {:#066b}",
        certificate.protocol_address,
        flag_bits,
        certificate.risk_flags
    );

    Ok(())
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct FlagAlert<'info> {
    /// Deve ser a mesma authority registrada no certificado.
    #[account(
        constraint = authority.key() == certificate.authority @ StpsError::Unauthorized
    )]
    pub authority: Signer<'info>,

    /// ProtocolCertificate PDA cujos flags serão atualizados.
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
pub struct AlertFlagged {
    /// Endereço do protocolo que recebeu o alerta.
    pub protocol_address: Pubkey,
    /// Bits que foram ativados nesta chamada.
    pub flag_bits: u64,
    /// Bitmask de flags antes da operação.
    pub old_flags: u64,
    /// Bitmask de flags após a operação (old_flags | flag_bits).
    pub new_flags: u64,
    /// Timestamp Unix do alerta.
    pub timestamp: i64,
}
