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
        <span>Tracked protocols</span>
        <strong>{protocols.length}</strong>
      </div>
      <div className="protocol-stack">
        {protocols.map((protocol) => (
          <button
            type="button"
            className="protocol-row"
            data-active={protocol.address === selectedAddress}
            key={protocol.address}
            onClick={() => onSelect(protocol.address)}
          >
            <span>
              <strong>{protocol.name}</strong>
              <small>{protocol.address}</small>
            </span>
            <em className={`risk-pill ${riskClass(protocol.riskLevel)}`}>{protocol.riskLevel}</em>
            <b>{protocol.score}</b>
          </button>
        ))}
      </div>
    </section>
  )
}
