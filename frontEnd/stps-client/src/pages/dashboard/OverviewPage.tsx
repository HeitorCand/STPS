import { riskClass } from '../../lib/risk'
import { Link } from 'react-router-dom'
import type { Protocol } from '../../types/stps'

type OverviewPageProps = {
  protocols: Protocol[]
  selectedProtocol: Protocol | null
  selectedAddress: string
  onSelectProtocol: (address: string) => void
}

export function OverviewPage({
  protocols,
  selectedProtocol,
  selectedAddress,
  onSelectProtocol,
}: OverviewPageProps) {
  const liveCount = protocols.filter((protocol) => protocol.dataStatus === 'live').length
  const pendingCount = protocols.filter((protocol) => protocol.dataStatus !== 'live').length
  const attentionCount = protocols.filter(
    (protocol) =>
      protocol.dataStatus !== 'live' ||
      protocol.riskLevel === 'High' ||
      protocol.riskLevel === 'Critical',
  ).length
  const attentionProtocols = protocols.filter(
    (protocol) =>
      protocol.dataStatus !== 'live' ||
      protocol.riskLevel === 'High' ||
      protocol.riskLevel === 'Critical',
  )
  const stableProtocols = protocols.filter(
    (protocol) => protocol.riskLevel === 'Low' && protocol.dataStatus === 'live',
  )

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <h1>Overview</h1>
          <p>
            Keep your monitored protocols in view, prioritize risky scores and inspect the
            current certificate before taking action.
          </p>
        </div>
      </div>

      <section className="summary-grid" aria-label="Workspace summary">
        <article className="summary-card">
          <span className="eyebrow">Protocols</span>
          <strong>{protocols.length}</strong>
          <p>Programs currently attached to this account watchlist.</p>
        </article>
        <article className="summary-card">
          <span className="eyebrow">Live</span>
          <strong>{liveCount}</strong>
          <p>Protocols with a calculated score and current risk band.</p>
        </article>
        <article className="summary-card">
          <span className="eyebrow">Pending</span>
          <strong>{pendingCount}</strong>
          <p>Protocols waiting for a calculated trust state from the server.</p>
        </article>
        <article className="summary-card">
          <span className="eyebrow">Attention</span>
          <strong>{attentionCount}</strong>
          <p>Protocols currently sitting in a High or Critical risk band.</p>
        </article>
      </section>

      {selectedProtocol ? (
        <>
          <section className="overview-focus" aria-label="Selected protocol overview">
            <div className="overview-focus__primary">
              <div className="overview-focus__head">
                <div>
                  <p className="eyebrow">Selected protocol</p>
                  <h2>{selectedProtocol.name}</h2>
                </div>
                <div className="overview-focus__pills">
                  <span className="claim-pill claimed">monitored</span>
                  <span className={`risk-pill ${riskClass(selectedProtocol.riskLevel)}`}>
                    {selectedProtocol.dataStatus === 'live' ? selectedProtocol.riskLevel : 'Not calculated'}
                  </span>
                </div>
              </div>
              <p className="overview-focus__address">{selectedProtocol.address}</p>
              <p className="overview-focus__copy">{selectedProtocol.recommendation}</p>
              <div className="overview-focus__facts">
                <div>
                  <span>Monitoring</span>
                  <strong>Added to watchlist</strong>
                </div>
                <div>
                  <span>Current score</span>
                  <strong>
                    {selectedProtocol.dataStatus === 'live' ? `${selectedProtocol.score}/100` : 'Not calculated'}
                  </strong>
                </div>
                <div>
                  <span>Last update</span>
                  <strong>{selectedProtocol.lastUpdate ?? 'Unavailable'}</strong>
                </div>
              </div>
              <Link className="overview-focus__link" to="/dashboard/protocols">
                Open protocol operations
              </Link>
            </div>
            <div className="overview-focus__secondary">
              <p className="eyebrow">Current posture</p>
              <ul className="overview-checklist">
                <li>
                  <strong>Watchlist state</strong>
                  <span>This account is following the protocol score and certificate state.</span>
                </li>
                <li>
                  <strong>Flags in view</strong>
                  <span>
                    {selectedProtocol.dataStatus !== 'live'
                      ? 'The server did not return a calculated trust state for this protocol yet.'
                      : selectedProtocol.activeFlags.length > 0
                      ? `${selectedProtocol.activeFlags.length} active risk flag${selectedProtocol.activeFlags.length === 1 ? '' : 's'} require attention.`
                      : 'No active risk flags are currently attached to this certificate.'}
                  </span>
                </li>
                <li>
                  <strong>Where to act</strong>
                  <span>
                    Use the protocols area for certificate, flags, timeline and watchlist
                    actions.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <div className="overview-panels">
            <section className="overview-list-panel" aria-label="Protocols needing attention">
              <div className="section-title">
                <span>Needs attention</span>
                <strong>{attentionProtocols.length}</strong>
              </div>
              {attentionProtocols.length > 0 ? (
                <div className="overview-list">
                  {attentionProtocols.slice(0, 5).map((protocol) => (
                    <button
                      key={protocol.id}
                      type="button"
                      className="overview-row"
                      data-active={protocol.address === selectedAddress}
                      onClick={() => onSelectProtocol(protocol.address)}
                    >
                      <span>
                        <strong>{protocol.name}</strong>
                        <small>{protocol.address}</small>
                      </span>
                      <span className="overview-row__meta">
                        <em className="claim-pill claimed">monitored</em>
                        <em className={`risk-pill ${riskClass(protocol.riskLevel)}`}>
                          {protocol.dataStatus === 'live' ? protocol.riskLevel : 'Not calculated'}
                        </em>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <strong>No protocol currently requires intervention</strong>
                  <p>Your monitored protocols are currently sitting outside the high-risk bands.</p>
                </div>
              )}
            </section>

            <section className="overview-list-panel" aria-label="Stable protocols">
              <div className="section-title">
                <span>Stable protocols</span>
                <strong>{stableProtocols.length}</strong>
              </div>
              {stableProtocols.length > 0 ? (
                <div className="overview-list">
                  {stableProtocols.slice(0, 4).map((protocol) => (
                    <button
                      key={protocol.id}
                      type="button"
                      className="overview-row"
                      data-active={protocol.address === selectedAddress}
                      onClick={() => onSelectProtocol(protocol.address)}
                    >
                      <span>
                        <strong>{protocol.name}</strong>
                        <small>{protocol.address}</small>
                      </span>
                      <span className="overview-row__meta">
                        <em className="claim-pill claimed">monitored</em>
                        <em className={`risk-pill ${riskClass(protocol.riskLevel)}`}>
                          {protocol.dataStatus === 'live' ? protocol.riskLevel : 'Not calculated'}
                        </em>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <strong>No fully stable protocol yet</strong>
                  <p>Low-risk protocols with live scores will appear here as the watchlist matures.</p>
                </div>
              )}
            </section>

          </div>
        </>
      ) : (
        <section className="workspace-empty workspace-empty--single" aria-label="Empty workspace">
          <div>
            <p className="eyebrow">No protocols yet</p>
            <h2>This workspace has no monitored protocol.</h2>
            <p>Go to the protocols area to register the first program for this account.</p>
          </div>
        </section>
      )}
    </section>
  )
}
