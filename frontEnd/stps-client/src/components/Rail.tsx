import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import stpsLogo from '../../../stps_logo_transparent.svg'

type RailProps = {
  sessionWallet: string | null
  onRefresh: () => void
  onLogout: () => void
}

export function Rail({ sessionWallet, onRefresh, onLogout }: RailProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const walletLabel = useMemo(
    () => (sessionWallet ? `${sessionWallet.slice(0, 4)}...${sessionWallet.slice(-4)}` : 'Wallet'),
    [sessionWallet],
  )

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [menuOpen])

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const handleCopyWallet = async () => {
    if (!sessionWallet) return
    try {
      await navigator.clipboard.writeText(sessionWallet)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <aside className="rail" aria-label="STPS client navigation">
      <NavLink className="rail-brand" to="/dashboard/overview" aria-label="STPS dashboard">
        <img src={stpsLogo} alt="STPS" />
      </NavLink>
      <nav className="rail-nav" aria-label="Dashboard sections">
        <NavLink to="/dashboard/overview">Overview</NavLink>
        <NavLink to="/dashboard/protocols">Protocols</NavLink>
        <NavLink to="/dashboard/tokens">Tokens</NavLink>
      </nav>
      <div className="rail-actions">
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
        <div className="account-menu" ref={menuRef}>
          <button
            type="button"
            className="account-menu__trigger"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((current) => !current)}
          >
            {walletLabel}
          </button>
          {menuOpen ? (
            <div className="account-menu__panel" role="menu" aria-label="Account actions">
              <div className="account-menu__wallet">
                <span className="eyebrow">Connected wallet</span>
                <strong>{sessionWallet ?? 'No connected wallet'}</strong>
              </div>
              <button type="button" className="account-menu__action" onClick={() => void handleCopyWallet()}>
                {copied ? 'Copied' : 'Copy wallet'}
              </button>
              <button type="button" className="account-menu__action account-menu__action--danger" onClick={onLogout}>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
