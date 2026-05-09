import { cleanReason, formatTime, scoreDelta } from './formatting'
import type { ApiProtocol, Protocol } from '../types/stps'

const protocolNames: Record<string, string> = {
  dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH: 'Drift V2',
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: 'Jupiter',
  MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD: 'Marinade',
}

export function toProtocol(apiProtocol: ApiProtocol): Protocol {
  return {
    name: protocolNames[apiProtocol.protocolAddress] ?? `Protocol ${apiProtocol.protocolAddress.slice(0, 4)}`,
    address: apiProtocol.protocolAddress,
    authority: 'Scoring Engine PDA',
    score: apiProtocol.currentScore,
    riskLevel: apiProtocol.riskLevel,
    lastUpdate: formatTime(apiProtocol.lastUpdate),
    environment: 'Production',
    activeFlags: apiProtocol.activeFlags,
    recommendation:
      apiProtocol.activeFlags.length > 0
        ? 'Review active flags before approving critical operations.'
        : 'Continue monitoring governance, asset and nonce changes.',
    history: apiProtocol.history.map((entry, index, history) => {
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
    }),
  }
}
