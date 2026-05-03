export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

/**
 * Espelha a derivação on-chain (`RiskLevel::from_score` em risk_level.rs):
 * - 81–100 → Low
 * - 61–80  → Medium
 * - 41–60  → High
 * - 0–40   → Critical
 */
export function deriveRiskLevel(score: number): RiskLevel {
  if (score > 80) return "Low";
  if (score > 60) return "Medium";
  if (score > 40) return "High";
  return "Critical";
}
