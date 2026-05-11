import { ScoreGraph } from './ScoreGraph'
import type { Protocol } from '../types/stps'

type ScoreTimelineProps = {
  protocol: Protocol
}

export function ScoreTimeline({ protocol }: ScoreTimelineProps) {
  if (protocol.dataStatus !== 'live' || protocol.history.length === 0 || protocol.score === null) {
    return (
      <section className="timeline-panel" id="timeline" aria-label="Score history">
        <div className="section-title">
          <span>Score timeline</span>
          <strong>Not calculated</strong>
        </div>
        <div className="empty-state">
          <strong>No score history available</strong>
          <p>The server has not returned a calculated score history for this protocol.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="timeline-panel" id="timeline" aria-label="Score history">
      <div className="section-title">
        <span>Score timeline</span>
        <strong>{protocol.history[0]?.score} to {protocol.score}</strong>
      </div>
      <ScoreGraph points={protocol.history} />
      <div className="timeline-list">
        {protocol.history.map((point) => (
          <article className="timeline-row" key={`${protocol.address}-${point.time}-${point.score}`}>
            <time>{point.time}</time>
            <span>
              <strong>{point.label}</strong>
              <small>{point.detail}</small>
            </span>
            <em>{point.delta}</em>
            <b>{point.score}</b>
          </article>
        ))}
      </div>
    </section>
  )
}
