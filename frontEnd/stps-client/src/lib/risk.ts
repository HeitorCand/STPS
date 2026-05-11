import type { RiskLevel } from '../types/stps'

export const riskCopy: Record<RiskLevel, string> = {
  Low: 'No critical flags active',
  Medium: 'Changes require monitoring',
  High: 'Operational review required',
  Critical: 'Immediate intervention required',
}

export function riskClass(level: RiskLevel | null) {
  if (!level) return 'unknown'
  return level.toLowerCase()
}
