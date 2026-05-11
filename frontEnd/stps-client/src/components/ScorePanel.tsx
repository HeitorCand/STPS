import { riskClass, riskCopy } from '../lib/risk'
import type { Protocol } from '../types/stps'

type ScorePanelProps = {
  protocol: Protocol
}

export function ScorePanel({ protocol }: ScorePanelProps) {
  const isCalculated =
    protocol.dataStatus === 'live' && protocol.score !== null && protocol.riskLevel !== null

  return (
    <section className="score-panel" aria-label={`${protocol.name} trust score`}>
      <div className="score-context">
        <span>{protocol.name}</span>
        <em>{protocol.environment}</em>
      </div>
      <div className="score-readout">
        <strong>{isCalculated ? protocol.score : '--'}</strong>
        <div>
          <span>Trust Score</span>
          <em className={`risk-pill ${riskClass(protocol.riskLevel)}`}>
            {isCalculated ? protocol.riskLevel : 'Not calculated'}
          </em>
        </div>
      </div>
      <div className="score-meter" aria-hidden="true">
        <span style={{ width: `${isCalculated ? protocol.score : 0}%` }} />
      </div>
      <p>
        {isCalculated
          ? `${riskCopy[protocol.riskLevel!]}. Claim status: ${protocol.claimStatus}. Last update: ${protocol.lastUpdate}.`
          : 'Trust score not calculated. The server did not restore a computed protocol state for this claim yet.'}
      </p>
    </section>
  )
}
