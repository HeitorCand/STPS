use anchor_lang::prelude::*;
use crate::state::ProtocolCertificate;
use crate::errors::StpsError;

// ---------------------------------------------------------------------------
// Instruction: close_certificate
// Fecha o ProtocolCertificate PDA e devolve o rent para a authority.
// Use quando um protocolo for desregistrado ou encerrado.
// ---------------------------------------------------------------------------

/// Fecha o ProtocolCertificate PDA, liberando o rent para a authority.
/// Somente a Scoring Authority original pode fechar o certificado.
pub fn close_certificate(ctx: Context<CloseCertificate>) -> Result<()> {
    let certificate = &ctx.accounts.certificate;
    let clock = Clock::get()?;

    emit!(CertificateClosed {
        protocol_address: certificate.protocol_address,
        authority: certificate.authority,
        final_score: certificate.trust_score,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Certificate closed: {} | final score: {}",
        certificate.protocol_address,
        certificate.trust_score
    );

    // A conta é fechada automaticamente pelo Anchor via `close = authority`
    Ok(())
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct CloseCertificate<'info> {
    /// Deve ser a mesma authority registrada no certificado.
    /// Recebe o rent (lamports) após o fechamento da conta.
    #[account(
        mut,
        constraint = authority.key() == certificate.authority @ StpsError::Unauthorized
    )]
    pub authority: Signer<'info>,

    /// ProtocolCertificate PDA a ser fechado.
    /// O discriminador `close = authority` garante que os lamports
    /// são transferidos para a authority e a conta é zerada.
    #[account(
        mut,
        close = authority,
        seeds = [b"stps", b"cert", certificate.protocol_address.as_ref()],
        bump = certificate.bump
    )]
    pub certificate: Account<'info, ProtocolCertificate>,

    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct CertificateClosed {
    /// Endereço do protocolo cujo certificado foi fechado.
    pub protocol_address: Pubkey,
    /// Authority que fechou o certificado.
    pub authority: Pubkey,
    /// Trust Score final no momento do fechamento.
    pub final_score: u8,
    /// Timestamp Unix do fechamento.
    pub timestamp: i64,
}
