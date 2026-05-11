import type { AuthStatus } from '../types/stps'

type WorkspaceHeaderProps = {
  authStatus: AuthStatus
  sessionWallet: string | null
  walletAvailable: boolean
  onRefresh: () => void
  onConnect: () => void
  onDisconnect: () => void
  signingIn: boolean
}

export function WorkspaceHeader({
  authStatus,
  sessionWallet,
  walletAvailable,
  onRefresh,
  onConnect,
  onDisconnect,
  signingIn,
}: WorkspaceHeaderProps) {
  const isSignedIn = authStatus === 'signed_in'

  return (
    <header className="workspace-header">
      <div>
        <p className="eyebrow">STPS Client</p>
        <h1>{isSignedIn ? 'Protocol monitoring workspace' : 'Protocol trust monitoring'}</h1>
        <p>
          {isSignedIn
            ? 'Track the programs attached to your account and keep score, flags and certificate views close.'
            : 'Connect a Solana wallet to create a private watchlist for the protocols you want to monitor.'}
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
      </div>
    </header>
  )
}
