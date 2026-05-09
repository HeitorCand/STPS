import { cleanReason, formatTime, scoreDelta } from './formatting'
import type { ApiClaim, ApiProtocol, Protocol } from '../types/stps'

const protocolNames: Record<string, string> = {
  dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH: 'Drift V2',
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: 'Jupiter',
  MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD: 'Marinade',
}

function protocolName(address: string, label?: string | null): string {
  return label ?? protocolNames[address] ?? `Protocol ${address.slice(0, 4)}`
}

function toHistory(apiProtocol: ApiProtocol) {
  return apiProtocol.history.map((entry, index, history) => {
    const reason = cleanReason(entry.reason)
    const [label, detail] = reason.includes(':')
      ? reason.split(/:(.*)/s).filter(Boolean)
      : [reason, 'Score updated by the Scoring Engine.']

    return {
      time: formatTime(entry.timestamp),
      score: entry.score,
      label: label.trim(),
      detail: detail.trim(),
      delta: scoreDelta(history[index - 1]?.score, entry.score),
    }
  })
}

export function toProtocol(claim: ApiClaim): Protocol {
  return {
    id: claim.id,
    name: protocolName(claim.protocolAddress, claim.label),
    address: claim.protocolAddress,
    authority:
      claim.verificationTarget ??
      (claim.verificationMethod === 'known_admin_signer'
        ? 'Known signer'
        : 'Scoring Engine PDA'),
    score: claim.protocol.currentScore,
    riskLevel: claim.protocol.riskLevel,
    lastUpdate: formatTime(claim.protocol.lastUpdate),
    environment: 'Production',
    activeFlags: claim.protocol.activeFlags,
    recommendation:
      claim.status === 'verified'
        ? 'Protocol control verified. Continue monitoring governance, asset and nonce changes.'
        : claim.protocol.activeFlags.length > 0
          ? 'Review active flags before approving critical operations.'
          : 'Complete verification to turn this claim into a monitored certificate workspace.',
    history: toHistory(claim.protocol),
    claimStatus: claim.status,
    verificationMethod: claim.verificationMethod,
    verificationTarget: claim.verificationTarget,
    verificationNotes: claim.verificationNotes,
    claimedByWallet: claim.claimedByWallet,
  }
}
