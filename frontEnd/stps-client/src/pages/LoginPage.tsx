import stpsLogo from '../assets/stps_logo_transparent.svg'
import { Link } from 'react-router-dom'

type LoginPageProps = {
  walletAvailable: boolean
  signingIn: boolean
  checkingSession: boolean
  statusMessage: string
  onConnect: () => void
}

export function LoginPage({
  walletAvailable,
  signingIn,
  checkingSession,
  statusMessage,
  onConnect,
}: LoginPageProps) {
  return (
    <main className="auth-shell">
      <section className="auth-hero" aria-hidden="true">
        <div className="auth-hero__brand">
          <div className="auth-hero__brand-row">
            <img src={stpsLogo} alt="STPS" />
            <Link className="auth-hero__back" to="/">
              Back to landing
            </Link>
          </div>
          <span className="eyebrow">Protocol trust workspace</span>
        </div>
        <div className="auth-hero__copy">
          <p className="eyebrow">STPS Client</p>
          <h1>Access your protocol monitoring workspace.</h1>
          <p>
            Sign in with a wallet and continue into a private STPS workspace for tracking
            protocol scores, flags and certificates.
          </p>
        </div>
      </section>

      <section className="auth-panel" aria-label="Wallet sign-in">
        <div className="auth-card">
          <div className="auth-card__header">
            <p className="eyebrow">Wallet sign-in</p>
            <h2>Connect your Solana wallet</h2>
            <p>
              STPS uses this signature flow to create your private workspace. You can add
              any protocol you want to monitor after sign-in.
            </p>
          </div>

          <div className="auth-card__status" data-available={walletAvailable}>
            <span>{walletAvailable ? 'Wallet detected' : 'Wallet unavailable'}</span>
            <strong>
              {walletAvailable
                ? 'Injected provider available in this browser session.'
                : 'Install or unlock Backpack, Phantom or another injected Solana wallet.'}
            </strong>
          </div>

          <button
            type="button"
            className="auth-card__action"
            onClick={onConnect}
            disabled={!walletAvailable || signingIn || checkingSession}
          >
            {checkingSession
              ? 'Restoring session...'
              : walletAvailable
                ? signingIn
                  ? 'Waiting for signature...'
                  : 'Connect wallet'
                : 'Wallet required'}
          </button>

          <div className="auth-card__warning" role="note">
            <strong>Your wallet identifies the watchlist.</strong>
            <p>
              Protocols you add are attached to this account so you can return to the same
              monitoring view later.
            </p>
          </div>

          <p className="auth-card__message">{statusMessage}</p>
        </div>
      </section>
    </main>
  )
}
