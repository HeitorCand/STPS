import heroImg from './assets/hero.png'
import stpsLogo from './assets/stps_logo.svg'
import './App.css'

const riskEvents = [
  {
    label: 'Timelock removed',
    detail: 'Critical governance action without delay window',
    penalty: '-30',
  },
  {
    label: 'Threshold lowered',
    detail: 'Multisig moved from 5 approvals to 1',
    penalty: '-20',
  },
  {
    label: 'Unknown signer',
    detail: 'New authority added with no reputation history',
    penalty: '-15',
  },
]

const riskFlags = [
  'FLAG_TIMELOCK_REMOVED',
  'FLAG_MULTISIG_THRESHOLD_LOWERED',
  'FLAG_UNKNOWN_SIGNER_ADDED',
]

const layers = [
  {
    id: 'L1',
    title: 'Governance Intelligence',
    copy: 'Detects multisig threshold drops, timelock removals, emergency keys and admin rule changes.',
  },
  {
    id: 'L2',
    title: 'Asset Legitimacy',
    copy: 'Flags new collateral, thin liquidity, holder concentration and suspicious market activity.',
  },
  {
    id: 'L3',
    title: 'Durable Nonce Watchdog',
    copy: 'Surfaces latent permissions from pre-signed operations that can execute later.',
  },
]

const useCases = [
  'Critical transactions',
  'Governance changes',
  'Admin permissions',
  'Asset legitimacy',
  'Durable nonces',
  'Protocol architecture',
]

const timeline = [
  { time: '00:00', score: '85', label: 'Baseline certificate issued', delta: 'baseline' },
  { time: '11:06', score: '65', label: 'Multisig threshold reduced', delta: '-20' },
  { time: '23:00', score: '42', label: 'Timelock removed, signer added', delta: '-23' },
]

const custodySteps = [
  {
    step: '01',
    title: 'Helius Webhooks',
    detail: 'Parsed governance and nonce events enter the pipeline.',
  },
  {
    step: '02',
    title: 'Indexer',
    detail: 'Raw activity becomes normalized risk events.',
  },
  {
    step: '03',
    title: 'Scoring Engine',
    detail: 'Flags, penalties and explanations produce the Trust Score.',
  },
  {
    step: '04',
    title: 'Anchor Program',
    detail: 'The certificate is written on-chain for verification.',
  },
  {
    step: '05',
    title: 'Dashboard + SDK',
    detail: 'Protocols, wallets and integrators read the same evidence.',
  },
]

function App() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#top" aria-label="STPS home">
            <img className="brand-logo" src={stpsLogo} alt="STPS" />
          </a>
          <nav className="nav-links" aria-label="Primary navigation">
            <a href="#layers">Layers</a>
            <a href="#demo">Demo</a>
            <a href="#developers">Developers</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a className="nav-cta" href="#demo">View demo</a>
        </div>
      </header>

      <section className="hero-section" id="top">
        <div className="hero-background" aria-hidden="true">
          <div className="chain-row row-one">
            <span>Helius Webhooks</span>
            <span>Indexer</span>
            <span>Scoring Engine</span>
            <span>Anchor Program</span>
          </div>
          <div className="chain-row row-two">
            <span>FLAG_TIMELOCK_REMOVED</span>
            <span>FLAG_UNKNOWN_SIGNER_ADDED</span>
            <span>FLAG_DURABLE_NONCE_DETECTED</span>
          </div>
          <img className="hero-asset" src={heroImg} alt="" />
        </div>

        <div className="hero-layout">
          <div className="hero-content">
            <p className="eyebrow">Solana Trust Protocol Standard</p>
            <div className="hero-stamp" aria-hidden="true">
              <span>Valid</span>
              <strong>is not safe</strong>
            </div>
            <h1>Trust certificates for protocols before users take the risk.</h1>
            <p className="hero-copy">
              STPS scores DeFi protocols from 0 to 100 by watching governance,
              asset legitimacy and latent permissions before valid transactions
              become unsafe operations.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#developers">Read the SDK</a>
              <a className="secondary-action" href="#layers">How it works</a>
            </div>
          </div>

          <div className="live-console" aria-label="Live trust certificate preview">
            <div className="console-header">
              <span>Protocol certificate</span>
              <strong>Devnet</strong>
            </div>
            <div className="certificate-seal" aria-hidden="true">
              <span>STPS</span>
              <strong>Risk<br />attested</strong>
            </div>
            <div className="certificate-meta">
              <span>protocol</span>
              <strong>dRiftyHA39MWEi3m9...cn33UH</strong>
            </div>
            <div className="certificate-fields" aria-label="Certificate metadata">
              <span>
                <small>Authority</small>
                <strong>Scoring Engine</strong>
              </span>
              <span>
                <small>Last update</small>
                <strong>23:00 UTC</strong>
              </span>
            </div>
            <div className="score-panel">
              <div>
                <span className="label">Trust Score</span>
                <strong>42</strong>
              </div>
              <span className="risk-badge">High risk</span>
            </div>
            <div className="score-line" aria-hidden="true">
              <span style={{ width: '85%' }} />
              <span style={{ width: '65%' }} />
              <span style={{ width: '42%' }} />
            </div>
            <ul className="event-list">
              {riskEvents.map((event) => (
                <li key={event.label}>
                  <span>
                    <strong>{event.label}</strong>
                    <small>{event.detail}</small>
                  </span>
                  <em>{event.penalty}</em>
                </li>
              ))}
            </ul>
            <div className="flag-strip" aria-label="Active risk flags">
              {riskFlags.map((flag) => (
                <span key={flag}>{flag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="custody-band" aria-label="STPS architecture chain of custody">
        <div className="custody-heading">
          <p className="eyebrow">Architecture</p>
          <h2>Every score has a chain of custody.</h2>
        </div>
        <div className="custody-rail">
          {custodySteps.map((item) => (
            <article className="custody-step" key={item.step}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
        <div className="proof-strip" aria-label="STPS status metrics">
          <div>
            <strong>3</strong>
            <span>risk layers</span>
          </div>
          <div>
            <strong>0-100</strong>
            <span>trust range</span>
          </div>
          <div>
            <strong>Devnet</strong>
            <span>first target</span>
          </div>
          <div>
            <strong>On-chain</strong>
            <span>certificate record</span>
          </div>
        </div>
      </section>

      <section className="section-band" id="layers">
        <div className="section-heading">
          <p className="eyebrow">Risk pipeline</p>
          <h2>One score, three independent checks.</h2>
          <p>
            The scoring engine receives normalized events, applies transparent
            deductions and writes the resulting certificate through Anchor.
          </p>
        </div>
        <div className="layer-grid">
          {layers.map((layer) => (
            <article className="layer-card" key={layer.id}>
              <span className="layer-id">{layer.id}</span>
              <div>
                <h3>{layer.title}</h3>
                <p>{layer.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="usecase-band">
        <div className="section-heading compact">
          <p className="eyebrow">Validation surface</p>
          <h2>Not a wallet score. A protocol risk layer.</h2>
        </div>
        <div className="usecase-grid">
          {useCases.map((item) => (
            <div className="usecase-item" key={item}>
              <span />
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="demo-band" id="demo">
        <div className="section-heading">
          <p className="eyebrow">Demo scenario</p>
          <h2>A valid transaction can still be unsafe.</h2>
          <p>
            The MVP simulates a Drift-like protocol where governance changes
            lower the score before the dangerous operation reaches users.
          </p>
        </div>
        <div className="timeline">
          {timeline.map((item) => (
            <article className="timeline-item" key={item.time}>
              <span>{item.time}</span>
              <em>{item.delta}</em>
              <strong>{item.score}</strong>
              <p>{item.label}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="developer-band" id="developers">
        <div className="section-heading">
          <p className="eyebrow">Developers</p>
          <h2>Expose trust in two calls.</h2>
          <p>
            The dashboard and SDK read the same scoring API. The on-chain
            certificate remains the verifiable source of record.
          </p>
        </div>
        <pre className="code-sample" aria-label="SDK example">
          <code>{`import { StpsClient } from "@stps/sdk";

const client = new StpsClient({
  rpcUrl: "https://api.devnet.solana.com"
});

const score = await client.getScore(protocolAddress);

if (score.riskLevel === "High") {
  requireAdditionalValidation();
}`}</code>
        </pre>
      </section>

      <section className="faq-band" id="faq">
        <div className="section-heading compact">
          <p className="eyebrow">FAQ</p>
          <h2>Common questions.</h2>
        </div>
        <div className="faq-grid">
          <article>
            <h3>Does STPS block transactions?</h3>
            <p>
              No. The MVP exposes risk signals so protocols, wallets and dApps
              can decide how to gate critical actions.
            </p>
          </article>
          <article>
            <h3>Where is the score calculated?</h3>
            <p>
              Off-chain in the Scoring Engine. Anchor stores the final
              certificate and validates the scoring authority.
            </p>
          </article>
          <article>
            <h3>Why durable nonces?</h3>
            <p>
              They can preserve latent permissions that typical transaction
              monitors miss until execution time.
            </p>
          </article>
        </div>
      </section>

      <footer className="footer">
        <span>STPS</span>
        <p>Preventive trust infrastructure for Solana protocols.</p>
      </footer>
    </main>
  )
}

export default App
