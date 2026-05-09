import { riskClass, riskCopy } from '../lib/risk'
import type { Protocol } from '../types/stps'

type ScorePanelProps = {
  protocol: Protocol
}

export function ScorePanel({ protocol }: ScorePanelProps) {
  return (
    <section className="score-panel" aria-label={`${protocol.name} trust score`}>
      <div className="score-context">
        <span>{protocol.name}</span>
        <em>{protocol.environment}</em>
      </div>
      <div className="score-readout">
        <strong>{protocol.score}</strong>
        <div>
          <span>Trust Score</span>
          <em className={`risk-pill ${riskClass(protocol.riskLevel)}`}>{protocol.riskLevel}</em>
        </div>
      </div>
      <div className="score-meter" aria-hidden="true">
        <span style={{ width: `${protocol.score}%` }} />
      </div>
      <p>{riskCopy[protocol.riskLevel]}. Last update: {protocol.lastUpdate}.</p>
    </section>
  )
}
