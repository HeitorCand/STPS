import type { Protocol } from '../types/stps'

type FlagsPanelProps = {
  protocol: Protocol
}

export function FlagsPanel({ protocol }: FlagsPanelProps) {
  if (protocol.dataStatus !== 'live') {
    return (
      <section className="flags-panel" aria-label="Active risk flags">
        <div className="section-title">
          <span>Active flags</span>
          <strong>--</strong>
        </div>
        <div className="empty-state">
          <strong>Trust state not calculated</strong>
          <p>The server did not return a computed protocol state for this claim yet.</p>
        </div>
        {protocol.verificationNotes ? <p className="verification-note">{protocol.verificationNotes}</p> : null}
        <p className="recommendation">{protocol.recommendation}</p>
      </section>
    )
  }

  return (
    <section className="flags-panel" aria-label="Active risk flags">
      <div className="section-title">
        <span>Active flags</span>
        <strong>{protocol.activeFlags.length}</strong>
      </div>
      {protocol.activeFlags.length > 0 ? (
        <ul className="flag-list">
          {protocol.activeFlags.map((flag) => (
            <li key={flag}>
              <span>{flag}</span>
              <small>Requires operator review</small>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <strong>No active risk flags</strong>
          <p>The protocol is still monitored for governance, asset and nonce changes.</p>
        </div>
      )}
      {protocol.verificationNotes ? <p className="verification-note">{protocol.verificationNotes}</p> : null}
      <p className="recommendation">{protocol.recommendation}</p>
    </section>
  )
}
