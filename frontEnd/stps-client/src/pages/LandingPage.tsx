import { Link } from "react-router-dom";
import heroImg from "../assets/hero.png";
import stpsLogo from "../assets/stps_logo.svg";
import "./LandingPage.css";

const riskEvents = [
  {
    label: "Timelock removed",
    detail: "Critical governance action without delay window",
    penalty: "-30",
  },
  {
    label: "Threshold lowered",
    detail: "Multisig moved from 5 approvals to 1",
    penalty: "-20",
  },
  {
    label: "Unknown signer",
    detail: "New authority added with no reputation history",
    penalty: "-15",
  },
];

const riskFlags = [
  "FLAG_TIMELOCK_REMOVED",
  "FLAG_MULTISIG_THRESHOLD_LOWERED",
  "FLAG_UNKNOWN_SIGNER_ADDED",
];

const layers = [
  {
    id: "L1",
    title: "Governance Intelligence",
    copy: "Detects multisig threshold drops, timelock removals, emergency keys and admin rule changes.",
  },
  {
    id: "L2",
    title: "Asset Legitimacy",
    copy: "Flags new collateral, thin liquidity, holder concentration and suspicious market activity.",
  },
  {
    id: "L3",
    title: "Durable Nonce Watchdog",
    copy: "Surfaces latent permissions from pre-signed operations that can execute later.",
  },
];

const useCases = [
  "Protocol-scoped monitoring",
  "Wallet-verified control",
  "Governance risk review",
  "Persistent SDK access tokens",
  "Certificate inspection",
  "Pre-execution trust checks",
];

const timeline = [
  {
    time: "00:00",
    score: "85",
    label: "Baseline certificate issued",
    delta: "baseline",
  },
  {
    time: "11:06",
    score: "65",
    label: "Multisig threshold reduced",
    delta: "-20",
  },
  {
    time: "23:00",
    score: "42",
    label: "Timelock removed, signer added",
    delta: "-23",
  },
];

const custodySteps = [
  {
    step: "01",
    title: "Operator workspace",
    detail:
      "Protocol teams sign in with the linked wallet and work only inside their own claimed surface.",
  },
  {
    step: "02",
    title: "Protocol operations",
    detail:
      "Claim, verify and inspect score, flags, timeline and certificate at the protocol level.",
  },
  {
    step: "03",
    title: "SDK token access",
    detail:
      "Persistent account tokens let backend services read only the protocols attached to that account.",
  },
];

const workspaceSteps = [
  {
    id: "01",
    title: "Sign in with the operator wallet",
    copy: "The login flow creates a private STPS session for the wallet that controls the protocol or is formally linked to it.",
  },
  {
    id: "02",
    title: "Claim the program address",
    copy: "The workspace becomes protocol-specific. Teams monitor only the programs attached to their account.",
  },
  {
    id: "03",
    title: "Generate SDK access when needed",
    copy: "Operators can create persistent account tokens so trusted services consume the same certificate view without exposing the wallet session.",
  },
];

const heroNotes = [
  "Wallet-gated workspace",
  "Protocol-specific certificate view",
  "Persistent SDK token access",
];

type LandingPageProps = {
  isSignedIn: boolean;
};

export function LandingPage({ isSignedIn }: LandingPageProps) {
  const workspaceHref = isSignedIn ? "/dashboard" : "/login";
  const workspaceLabel = isSignedIn ? "Open dashboard" : "Open workspace";

  return (
    <div className="landing-page">
      <main className="site-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <Link className="brand" to="/" aria-label="STPS home">
              <img className="brand-logo" src={stpsLogo} alt="STPS" />
            </Link>
            <nav className="nav-links" aria-label="Primary navigation">
              <a href="#model">Model</a>
              <a href="#layers">Signals</a>
              <a href="#workspace">Workspace</a>
              <a href="#demo">Demo</a>
              <a href="#developers">SDK</a>
              <a
                href="https://miguelclaret.github.io/STPS/"
                target="_blank"
                rel="noreferrer"
              >
                Docs
              </a>
              <a href="#faq">FAQ</a>
            </nav>
            <Link className="nav-cta" to={workspaceHref}>
              {workspaceLabel}
            </Link>
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
                <span>Private</span>
                <strong>operator trust workspace</strong>
              </div>
              <h1>
                Trust certificates for protocols before users take the risk.
              </h1>
              <p className="hero-copy">
                STPS turns protocol trust into an operator surface. Teams sign
                in with the linked wallet, claim the program they manage, verify
                control and expose the same protocol certificate through
                persistent SDK tokens when automation needs it.
              </p>
              <div className="hero-actions">
                <Link className="primary-action" to={workspaceHref}>
                  {workspaceLabel}
                </Link>
                <a className="secondary-action" href="#layers">
                  How it works
                </a>
              </div>
              <div className="hero-notes" aria-label="Workspace capabilities">
                {heroNotes.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            <div
              className="live-console"
              aria-label="Live trust certificate preview"
            >
              <div className="console-header">
                <span>Operator workspace</span>
                <strong>Claimed protocol</strong>
              </div>
              <div className="certificate-seal" aria-hidden="true">
                <span>STPS</span>
                <strong>
                  Control
                  <br />
                  verified
                </strong>
              </div>
              <div className="certificate-meta">
                <span>workspace</span>
                <strong>dRiftyHA39MWEi3m9...cn33UH</strong>
              </div>
              <div
                className="certificate-fields"
                aria-label="Certificate metadata"
              >
                <span>
                  <small>Claim status</small>
                  <strong>Verified</strong>
                </span>
                <span>
                  <small>Verification</small>
                  <strong>Upgrade authority</strong>
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
                <span style={{ width: "85%" }} />
                <span style={{ width: "65%" }} />
                <span style={{ width: "42%" }} />
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

        <section
          className="custody-band"
          id="model"
          aria-label="STPS operator flow"
        >
          <div className="custody-heading">
            <p className="eyebrow">Workspace model</p>
            <h2>The trust layer is now an operator product.</h2>
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
              <strong>Wallet</strong>
              <span>operator sign-in</span>
            </div>
            <div>
              <strong>Claim</strong>
              <span>protocol-scoped surface</span>
            </div>
            <div>
              <strong>SDK token</strong>
              <span>persistent account access</span>
            </div>
          </div>
        </section>

        <section className="workspace-band" id="workspace">
          <div className="section-heading">
            <p className="eyebrow">Operator workspace</p>
            <h2>One entrypoint for the team that operates the protocol.</h2>
            <p>
              Public trust still matters, but the core product now lives in a
              private operator surface. Teams enter with the governance-linked
              wallet, claim the program and extend the same certificate trail
              into the SDK only after access is explicitly created.
            </p>
          </div>
          <div className="workspace-grid">
            {workspaceSteps.map((step) => (
              <article className="workspace-step" key={step.id}>
                <span>{step.id}</span>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
          <div className="workspace-cta">
            <div>
              <p className="eyebrow">Access model</p>
              <strong>
                {isSignedIn
                  ? "Your workspace session is active."
                  : "Start with wallet sign-in."}
              </strong>
              <p>
                {isSignedIn
                  ? "Go straight to the claimed-protocol dashboard and continue from your account workspace."
                  : "The login route issues a wallet challenge, then unlocks claim, verification and SDK token flows in the dashboard."}
              </p>
            </div>
            <Link className="workspace-cta__action" to={workspaceHref}>
              {workspaceLabel}
            </Link>
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
            <p className="eyebrow">SDK access</p>
            <h2>Use the same protocol view outside the dashboard.</h2>
            <p>
              The SDK now consumes account-scoped access. Operators create a
              persistent token in the dashboard, then backend services read only
              the protocols linked to that account.
            </p>
            <div className="section-actions">
              <a
                href="https://miguelclaret.github.io/STPS/"
                target="_blank"
                rel="noreferrer"
              >
                Read docs
              </a>
            </div>
          </div>
          <pre className="code-sample" aria-label="SDK example">
            <code>{`import { StpsClient } from "stps-sdk";

const client = new StpsClient({
  token: process.env.STPS_API_TOKEN!,
});

const protocols = await client.getProtocols();
const score = await client.getScore(protocols[0].protocolAddress);`}</code>
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
                No. STPS exposes trust signals so protocols, wallets and dApps
                can decide how to gate critical actions.
              </p>
            </article>
            <article>
              <h3>Who can see a protocol in the dashboard?</h3>
              <p>
                The operator workspace is account-scoped. After sign-in, teams
                see only the protocols they claimed through that account.
              </p>
            </article>
            <article>
              <h3>How does the SDK access work?</h3>
              <p>
                Operators generate a persistent token in the dashboard, then use
                it in `stps-sdk` to read the same account-linked protocol
                surface outside the UI.
              </p>
            </article>
          </div>
        </section>

        <footer className="footer">
          <span>STPS</span>
          <p>Preventive trust infrastructure for Solana protocols.</p>
        </footer>
      </main>
    </div>
  );
}
