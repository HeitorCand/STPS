use anchor_lang::prelude::*;

// ---------------------------------------------------------------------------
// RiskLevel enum
// Derivado automaticamente a partir do trust_score.
// ---------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace, Debug)]
pub enum RiskLevel {
    /// Score 81–100 — Governança saudável, ativos legítimos.
    Low,
    /// Score 61–80 — Mudanças recentes merecem atenção. Monitore.
    Medium,
    /// Score 41–60 — Risco elevado. Reduzir exposição recomendado.
    High,
    /// Score 0–40 — Risco iminente. Alertas ativos. Saída urgente.
    Critical,
}

impl RiskLevel {
    /// Deriva o RiskLevel a partir de um trust_score (0–100).
    pub fn from_score(score: u8) -> Self {
        match score {
            81..=100 => RiskLevel::Low,
            61..=80  => RiskLevel::Medium,
            41..=60  => RiskLevel::High,
            _        => RiskLevel::Critical,
        }
    }
}
