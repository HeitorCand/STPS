import type { AuthStatus, Protocol } from '../types/stps'

type WorkspaceHeaderProps = {
  authStatus: AuthStatus
  sessionWallet: string | null
  walletAvailable: boolean
  selectedProtocol: Protocol | null
  onRefresh: () => void
  onConnect: () => void
  onDisconnect: () => void
  onVerifySelected: () => void
  signingIn: boolean
  verifying: boolean
}

export function WorkspaceHeader({
  authStatus,
  sessionWallet,
  walletAvailable,
  selectedProtocol,
  onRefresh,
  onConnect,
  onDisconnect,
  onVerifySelected,
  signingIn,
  verifying,
}: WorkspaceHeaderProps) {
  const isSignedIn = authStatus === 'signed_in'
  const selectedNeedsVerification = selectedProtocol?.claimStatus !== 'verified'

  return (
    <header className="workspace-header">
      <div>
        <p className="eyebrow">STPS Client</p>
        <h1>{isSignedIn ? 'Controlled protocol workspaces' : 'Protocol trust operations'}</h1>
        <p>
          {isSignedIn
            ? 'Operate from your own claimed programs, verify control with a wallet signature and keep the certificate view tied to your account.'
            : 'Connect a Solana wallet to claim a protocol, prove control and turn the STPS client into a private monitoring workspace.'}
        </p>
      </div>
      <div className="header-actions">
        {isSignedIn ? (
          <button type="button" onClick={onDisconnect}>
            {sessionWallet ? `${sessionWallet.slice(0, 4)}...${sessionWallet.slice(-4)}` : 'Disconnect'}
          </button>
        ) : (
          <button type="button" onClick={onConnect} disabled={!walletAvailable || signingIn}>
            {walletAvailable ? (signingIn ? 'Signing in...' : 'Connect wallet') : 'Wallet required'}
          </button>
        )}
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!isSignedIn || !selectedProtocol || verifying || !selectedNeedsVerification}
          title={
            selectedNeedsVerification
              ? 'Sign a challenge to verify control of the selected protocol'
              : 'Selected protocol is already verified'
          }
          onClick={onVerifySelected}
        >
          {verifying ? 'Verifying...' : 'Verify control'}
        </button>
      </div>
    </header>
  )
}
