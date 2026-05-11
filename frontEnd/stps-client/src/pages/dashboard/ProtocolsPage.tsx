import { CertificatePanel } from '../../components/CertificatePanel'
import { FlagsPanel } from '../../components/FlagsPanel'
import { ProtocolList } from '../../components/ProtocolList'
import { ScorePanel } from '../../components/ScorePanel'
import { ScoreTimeline } from '../../components/ScoreTimeline'
import type { Protocol } from '../../types/stps'

type ProtocolsPageProps = {
  protocols: Protocol[]
  selectedProtocol: Protocol | null
  selectedAddress: string
  claimAddress: string
  claimLabel: string
  claiming: boolean
  onSelectProtocol: (address: string) => void
  onClaimAddressChange: (value: string) => void
  onClaimLabelChange: (value: string) => void
  onSubmitClaim: () => void
}

export function ProtocolsPage({
  protocols,
  selectedProtocol,
  selectedAddress,
  claimAddress,
  claimLabel,
  claiming,
  onSelectProtocol,
  onClaimAddressChange,
  onClaimLabelChange,
  onSubmitClaim,
}: ProtocolsPageProps) {
  return (
    <section className="workspace-page">
      <div className="page-header page-header--split">
        <div>
          <p className="eyebrow">Protocols</p>
          <h1>Monitor protocols</h1>
          <p>
            Add any program address you want to follow and keep its score, flags, certificate
            and history attached to this account.
          </p>
        </div>
      </div>

      <section className="protocols-layout">
        <form
          className="claim-card claim-card--standalone"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmitClaim()
          }}
        >
          <div className="section-title">
            <span>Add protocol</span>
            <strong>Watchlist</strong>
          </div>
          <label>
            <span>Program address</span>
            <input
              type="text"
              placeholder="Paste a Solana program address"
              value={claimAddress}
              onChange={(event) => onClaimAddressChange(event.target.value)}
              disabled={claiming}
            />
          </label>
          <label>
            <span>Watchlist label</span>
            <input
              type="text"
              placeholder="Optional display name"
              value={claimLabel}
              onChange={(event) => onClaimLabelChange(event.target.value)}
              disabled={claiming}
            />
          </label>
          <button
            type="submit"
            className="primary-inline-button"
            disabled={claiming || claimAddress.trim().length < 32}
          >
            {claiming ? 'Adding...' : 'Add protocol'}
          </button>
        </form>

        <ProtocolList
          protocols={protocols}
          selectedAddress={selectedAddress}
          onSelect={onSelectProtocol}
        />
      </section>

      {selectedProtocol ? (
        <section className="protocol-detail-grid">
          <ScorePanel protocol={selectedProtocol} />
          <CertificatePanel protocol={selectedProtocol} />
          <FlagsPanel protocol={selectedProtocol} />
          <ScoreTimeline protocol={selectedProtocol} />
        </section>
      ) : null}
    </section>
  )
}
