export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical'

export type DataStatus = 'loading' | 'live' | 'fallback' | 'error'

export type ScorePoint = {
  time: string
  score: number
  label: string
  detail: string
  delta: string
}

export type Protocol = {
  name: string
  address: string
  authority: string
  score: number
  riskLevel: RiskLevel
  lastUpdate: string
  environment: string
  activeFlags: string[]
  recommendation: string
  history: ScorePoint[]
}

export type ApiHistoryEntry = {
  timestamp: number
  score: number
  reason: string
}

export type ApiProtocol = {
  protocolAddress: string
  currentScore: number
  riskLevel: RiskLevel
  activeFlags: string[]
  riskFlagsBitmask: string
  lastUpdate: number
  history: ApiHistoryEntry[]
}

export type ApiProtocolListResponse = {
  count: number
  protocols: ApiProtocol[]
}
