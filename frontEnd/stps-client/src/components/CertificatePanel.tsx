import type { Protocol } from '../types/stps'

type CertificatePanelProps = {
  protocol: Protocol
}

export function CertificatePanel({ protocol }: CertificatePanelProps) {
  const isCalculated = protocol.dataStatus === 'live'

  return (
    <section className="certificate-panel" id="certificate" aria-label="Protocol certificate">
      <div className="certificate-head">
        <span>Protocol Certificate</span>
        <strong>{protocol.environment}</strong>
      </div>
      <div className="certificate-grid">
        <div>
          <small>Protocol address</small>
          <strong>{protocol.address}</strong>
        </div>
        <div>
          <small>Authority</small>
          <strong>{protocol.authority}</strong>
        </div>
        <div>
          <small>Current score</small>
          <strong>{isCalculated ? `${protocol.score}/100` : 'Not calculated'}</strong>
        </div>
        <div>
          <small>Risk level</small>
          <strong>{isCalculated ? protocol.riskLevel : 'Server issue'}</strong>
        </div>
        <div>
          <small>Claim status</small>
          <strong>{protocol.claimStatus}</strong>
        </div>
        <div>
          <small>Verification target</small>
          <strong>{protocol.verificationTarget ?? 'Awaiting proof'}</strong>
        </div>
      </div>
      <div className="certificate-seal" aria-hidden="true">
        <span>STPS</span>
        <strong>Risk attested</strong>
      </div>
    </section>
  )
}
