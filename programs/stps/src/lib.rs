use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

// ---------------------------------------------------------------------------
// Program ID
// Atualizar após o primeiro `anchor deploy --provider.cluster devnet`
// e rodar `anchor build` novamente para o IDL refletir o novo ID.
// ---------------------------------------------------------------------------
declare_id!("FuAM2peBxYQgr4Sspd43FkYK7vuCZ5rTPxZYCnCSeCZk");

#[program]
pub mod stps {
    use super::*;

    /// Registra um novo protocolo no STPS e cria o ProtocolCertificate PDA.
    /// Deve ser chamado pelo Scoring Engine ao adicionar um protocolo.
    pub fn register_protocol(
        ctx: Context<RegisterProtocol>,
        protocol_address: Pubkey,
        initial_score: u8,
    ) -> Result<()> {
        instructions::register_protocol(ctx, protocol_address, initial_score)
    }

    /// Atualiza o Trust Score e os risk_flags de um certificado existente.
    /// Somente a Scoring Authority pode chamar esta instrução.
    /// Chamado pelo Scoring Engine quando |Δscore| >= 5.
    pub fn update_score(
        ctx: Context<UpdateScore>,
        new_score: u8,
        new_risk_flags: u64,
    ) -> Result<()> {
        instructions::update_score(ctx, new_score, new_risk_flags)
    }

    /// Ativa bits específicos no risk_flags sem recalcular o score completo.
    /// Útil para eventos urgentes que precisam ser sinalizados imediatamente.
    pub fn flag_alert(ctx: Context<FlagAlert>, flag_bits: u64) -> Result<()> {
        instructions::flag_alert(ctx, flag_bits)
    }

    /// Fecha o ProtocolCertificate PDA e devolve o rent à authority.
    /// Use ao desregistrar um protocolo.
    pub fn close_certificate(ctx: Context<CloseCertificate>) -> Result<()> {
        instructions::close_certificate(ctx)
    }
}
