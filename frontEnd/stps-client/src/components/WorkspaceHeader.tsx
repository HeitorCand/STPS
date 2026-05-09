type WorkspaceHeaderProps = {
  onRefresh: () => void
}

export function WorkspaceHeader({ onRefresh }: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <div>
        <p className="eyebrow">STPS Client</p>
        <h1>Protocol trust operations</h1>
        <p>
          Monitor certificates, score movement and active risk flags before
          a valid Solana action becomes an unsafe operation.
        </p>
      </div>
      <div className="header-actions">
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
        <button
          type="button"
          className="primary-button"
          disabled
          title="Registration requires the Scoring Authority"
        >
          Register protocol
        </button>
      </div>
    </header>
  )
}
