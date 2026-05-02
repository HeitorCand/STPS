use anchor_lang::prelude::*;

#[error_code]
pub enum StpsError {
    /// A conta `authority` não corresponde à authority registrada no certificado.
    #[msg("Unauthorized: signer is not the Scoring Authority for this certificate")]
    Unauthorized,

    /// O trust_score fornecido está fora do intervalo válido [0, 100].
    #[msg("Invalid score: trust_score must be between 0 and 100")]
    InvalidScore,

    /// O score_initial fornecido no registro está fora do intervalo válido [0, 100].
    #[msg("Invalid initial score: value must be between 0 and 100")]
    InvalidInitialScore,

    /// Tentativa de registrar um protocolo que já possui um certificado ativo.
    #[msg("Protocol already registered: a certificate PDA exists for this address")]
    AlreadyRegistered,

    /// Operação aritmética resultaria em overflow ou underflow.
    #[msg("Arithmetic overflow or underflow")]
    ArithmeticError,
}
