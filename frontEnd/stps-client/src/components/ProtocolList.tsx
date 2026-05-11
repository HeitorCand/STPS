import { riskClass } from '../lib/risk'
import type { Protocol } from '../types/stps'

type ProtocolListProps = {
  protocols: Protocol[]
  selectedAddress: string
  onSelect: (address: string) => void
}

export function ProtocolList({ protocols, selectedAddress, onSelect }: ProtocolListProps) {
  return (
    <section className="protocol-list" aria-label="Tracked protocols">
      <div className="section-title">
        <span>Managed protocols</span>
        <strong>{protocols.length}</strong>
      </div>
      {protocols.length === 0 ? (
        <div className="empty-state compact">
          <strong>No claimed protocols</strong>
          <p>Claim a program address and verify control to start a private monitoring workspace.</p>
        </div>
      ) : null}
      <div className="protocol-stack">
        {protocols.map((protocol) => (
          <button
            type="button"
            className="protocol-row"
            data-active={protocol.address === selectedAddress}
            key={protocol.id}
            onClick={() => onSelect(protocol.address)}
          >
            <span>
              <strong>{protocol.name}</strong>
              <small>{protocol.address}</small>
            </span>
            <span className="protocol-meta">
              <em className={`claim-pill ${protocol.claimStatus}`}>{protocol.claimStatus}</em>
              <em className={`risk-pill ${riskClass(protocol.riskLevel)}`}>
                {protocol.dataStatus === 'live' ? protocol.riskLevel : 'Not calculated'}
              </em>
            </span>
            <b>{protocol.dataStatus === 'live' ? protocol.score : '--'}</b>
          </button>
        ))}
      </div>
    </section>
  )
}
