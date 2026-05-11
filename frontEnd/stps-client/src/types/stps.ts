export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical'
export type DataStatus = 'loading' | 'live' | 'fallback' | 'error' | 'not_calculated'
export type AuthStatus = 'checking' | 'signed_out' | 'signing_in' | 'signed_in'
export type ClaimStatus = 'claimed' | 'verified' | 'manual_review'
export type VerificationMethod = 'upgrade_authority' | 'known_admin_signer' | null

export type ScorePoint = {
  time: string
  score: number
  label: string
  detail: string
  delta: string
}

export type Protocol = {
  id: string
  name: string
  address: string
  authority: string
  score: number | null
  riskLevel: RiskLevel | null
  lastUpdate: string | null
  environment: string
  activeFlags: string[]
  recommendation: string
  history: ScorePoint[]
  claimStatus: ClaimStatus
  verificationMethod: VerificationMethod
  verificationTarget: string | null
  verificationNotes: string | null
  claimedByWallet: string
  dataStatus: 'live' | 'not_calculated'
  isPreview?: boolean
}

export type ApiHistoryEntry = {
  timestamp: number
  score: number
  reason: string
}

export type ApiProtocol = {
  protocolAddress: string
  currentScore: number | null
  riskLevel: RiskLevel | null
  activeFlags: string[]
  riskFlagsBitmask: string
  lastUpdate: number | null
  history: ApiHistoryEntry[]
  dataStatus: 'live' | 'not_calculated'
}

export type ApiProtocolListResponse = {
  count: number
  protocols: ApiProtocol[]
}

export type ApiChallengeResponse = {
  status: 'ok'
  challengeId: string
  message: string
  expiresAt: string
  inspection?: {
    upgradeAuthorityAddress: string | null
  }
}

export type ApiSessionUser = {
  id: string
  primaryWalletAddress: string
  displayName?: string | null
}

export type ApiSessionInfo = {
  id: string
  walletAddress: string
  expiresAt: string
}

export type ApiMeResponse = {
  status: 'ok'
  user: ApiSessionUser
  session: ApiSessionInfo | null
  apiToken?: {
    id: string
    label: string | null
    createdAt: string
    lastUsedAt: string | null
  } | null
}

export type ApiToken = {
  id: string
  label: string | null
  createdAt: string
  lastUsedAt: string | null
  revokedAt?: string | null
}

export type ApiAuthVerifyResponse = Omit<ApiMeResponse, 'session'> & {
  token: string
  session: ApiSessionInfo
}

export type ApiClaim = {
  id: string
  label: string | null
  protocolAddress: string
  claimedByWallet: string
  status: ClaimStatus
  verificationMethod: VerificationMethod
  verificationTarget: string | null
  verificationNotes: string | null
  registrationTxSignature: string | null
  createdAt: string
  updatedAt: string
  protocol: ApiProtocol
}

export type ApiManagedProtocolListResponse = {
  status: 'ok'
  count: number
  protocols: ApiClaim[]
}

export type ApiClaimResponse = {
  status: 'ok'
  claim: ApiClaim
}

export type ApiTokenListResponse = {
  status: 'ok'
  count: number
  tokens: ApiToken[]
}

export type ApiCreateTokenResponse = {
  status: 'ok'
  token: string
  apiToken: ApiToken
}
