import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { Rail } from './components/Rail'
import { mockProtocols } from './data/mockProtocols'
import {
  claimProtocol,
  createApiToken,
  fetchApiTokens,
  fetchManagedProtocols,
  fetchMe,
  fetchScoringHealth,
  logout,
  revokeApiToken,
  requestAuthChallenge,
  verifyAuthChallenge,
} from './lib/api'
import { toProtocol } from './lib/adapters'
import {
  connectInjectedWallet,
  disconnectInjectedWallet,
  hasInjectedWallet,
  signUtf8Message,
  subscribeWalletDisconnect,
} from './lib/wallet'
import { OverviewPage } from './pages/dashboard/OverviewPage'
import { ProtocolsPage } from './pages/dashboard/ProtocolsPage'
import { TokensPage } from './pages/dashboard/TokensPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import type { ApiToken, AuthStatus, Protocol } from './types/stps'
import './App.css'

const SESSION_TOKEN_KEY = 'stps.session.token'

function App() {
  const navigate = useNavigate()
  const [protocols, setProtocols] = useState<Protocol[]>(mockProtocols)
  const [selectedAddress, setSelectedAddress] = useState(mockProtocols[0].address)
  const [statusMessage, setStatusMessage] = useState('Connecting to production Scoring Engine')
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    window.localStorage.getItem(SESSION_TOKEN_KEY),
  )
  const [sessionWallet, setSessionWallet] = useState<string | null>(null)
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([])
  const [tokenLabel, setTokenLabel] = useState('')
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [creatingToken, setCreatingToken] = useState(false)
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null)
  const [claimAddress, setClaimAddress] = useState('')
  const [claimLabel, setClaimLabel] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [walletAvailable, setWalletAvailable] = useState(false)
  const logoutInFlightRef = useRef(false)

  useEffect(() => {
    const syncWalletAvailability = () => {
      setWalletAvailable(hasInjectedWallet())
    }

    syncWalletAvailability()
    const interval = window.setInterval(syncWalletAvailability, 750)
    window.addEventListener('focus', syncWalletAvailability)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', syncWalletAvailability)
    }
  }, [])

  const loadWorkspace = useCallback(
    async (token: string | null) => {
      setStatusMessage('Connecting to production Scoring Engine')

      const health = await fetchScoringHealth().catch(() => null)
      if (!health) {
        setStatusMessage('Scoring Engine unreachable — data may be stale')
      }

      if (!token) {
        setProtocols(mockProtocols)
        setApiTokens([])
        setSelectedAddress(mockProtocols[0].address)
        setAuthStatus('signed_out')
        setStatusMessage(
          walletAvailable
            ? 'Connect a wallet to access your protocol watchlist.'
            : 'Install a Solana wallet to access your protocol watchlist.',
        )
        return
      }

      try {
        const me = await fetchMe(token)
        setSessionWallet(me.session?.walletAddress ?? me.user.primaryWalletAddress)

        const [protocolResponse, tokenResponse] = await Promise.all([
          fetchManagedProtocols(token),
          fetchApiTokens(token),
        ])
        const managedProtocols = protocolResponse.protocols.map(toProtocol)

        setProtocols(managedProtocols)
        setApiTokens(tokenResponse.tokens)
        setSelectedAddress((current) =>
          managedProtocols.some((protocol) => protocol.address === current)
            ? current
            : managedProtocols[0]?.address ?? '',
        )
        setAuthStatus('signed_in')
        setStatusMessage(
          managedProtocols.length > 0
            ? `Loaded ${managedProtocols.length} monitored protocol${managedProtocols.length === 1 ? '' : 's'} for your account`
            : 'Signed in. Add a program address to start monitoring STPS scores.',
        )
      } catch (error) {
        window.localStorage.removeItem(SESSION_TOKEN_KEY)
        setSessionToken(null)
        setSessionWallet(null)
        setApiTokens([])
        setProtocols(mockProtocols)
        setSelectedAddress(mockProtocols[0].address)
        setAuthStatus('signed_out')
        setStatusMessage(error instanceof Error ? error.message : 'Could not load your workspace')
      }
    },
    [walletAvailable],
  )

  useEffect(() => {
    let cancelled = false
    window.setTimeout(() => {
      if (!cancelled) {
        void loadWorkspace(sessionToken)
      }
    }, 0)

    return () => {
      cancelled = true
    }
  }, [loadWorkspace, sessionToken])

  const selected = useMemo(
    () => protocols.find((protocol) => protocol.address === selectedAddress) ?? null,
    [protocols, selectedAddress],
  )
  const isSigningIn = authStatus === 'signing_in'

  const handleConnect = useCallback(async () => {
    try {
      setAuthStatus('signing_in')
      const walletAddress = await connectInjectedWallet()
      const challenge = await requestAuthChallenge(walletAddress)
      const signature = await signUtf8Message(challenge.message)
      const session = await verifyAuthChallenge({
        challengeId: challenge.challengeId,
        walletAddress,
        signature,
      })

      window.localStorage.setItem(SESSION_TOKEN_KEY, session.token)
      setSessionToken(session.token)
      setSessionWallet(session.session.walletAddress)
      await loadWorkspace(session.token)
      navigate('/dashboard/overview', { replace: true })
    } catch (error) {
      setAuthStatus('signed_out')
      setStatusMessage(error instanceof Error ? error.message : 'Wallet sign-in failed')
    }
  }, [loadWorkspace, navigate])

  const handleDisconnect = useCallback(async () => {
    if (logoutInFlightRef.current) return
    logoutInFlightRef.current = true
    try {
      if (sessionToken) {
        await logout(sessionToken)
      }
    } catch {
      // best effort logout
    } finally {
      window.localStorage.removeItem(SESSION_TOKEN_KEY)
      setSessionToken(null)
      setSessionWallet(null)
      setApiTokens([])
      setRevealedToken(null)
      setTokenLabel('')
      setClaimAddress('')
      setClaimLabel('')
      await disconnectInjectedWallet()
      await loadWorkspace(null)
      navigate('/login', { replace: true })
      logoutInFlightRef.current = false
    }
  }, [loadWorkspace, navigate, sessionToken])

  useEffect(() => {
    if (authStatus !== 'signed_in') return

    return subscribeWalletDisconnect(() => {
      void handleDisconnect()
    })
  }, [authStatus, handleDisconnect])

  const handleRefresh = useCallback(async () => {
    await loadWorkspace(sessionToken)
  }, [loadWorkspace, sessionToken])

  const handleClaim = useCallback(async () => {
    if (!sessionToken) return

    try {
      setClaiming(true)
      const response = await claimProtocol(sessionToken, claimAddress.trim(), claimLabel.trim() || undefined)
      const protocol = toProtocol(response.claim)
      setProtocols((current) => {
        const next = [protocol, ...current.filter((item) => item.address !== protocol.address)]
        return next
      })
      setSelectedAddress(protocol.address)
      setClaimAddress('')
      setClaimLabel('')
      setStatusMessage(`${protocol.name} added to your monitored protocols.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add protocol'
      setStatusMessage(
        message === 'already_tracked' || message === 'already_claimed'
          ? 'This protocol is already in your watchlist.'
          : message,
      )
    } finally {
      setClaiming(false)
    }
  }, [claimAddress, claimLabel, sessionToken])

  const handleCreateToken = useCallback(async () => {
    if (!sessionToken) return

    try {
      setCreatingToken(true)
      const response = await createApiToken(sessionToken, tokenLabel)
      setApiTokens((current) => [response.apiToken, ...current])
      setRevealedToken(response.token)
      setTokenLabel('')
      setStatusMessage('SDK token created. Copy the raw token now, it will not be shown again.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not create API token')
    } finally {
      setCreatingToken(false)
    }
  }, [sessionToken, tokenLabel])

  const handleRevokeToken = useCallback(
    async (tokenId: string) => {
      if (!sessionToken) return

      try {
        setRevokingTokenId(tokenId)
        await revokeApiToken(sessionToken, tokenId)
        setApiTokens((current) => current.filter((token) => token.id !== tokenId))
        setStatusMessage('SDK token revoked.')
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Could not revoke API token')
      } finally {
        setRevokingTokenId(null)
      }
    },
    [sessionToken],
  )

  const showEmptyWorkspace = authStatus === 'signed_in' && protocols.length === 0
  const liveCount = protocols.filter((protocol) => protocol.dataStatus === 'live').length

  return (
    <Routes>
      <Route path="/" element={<LandingPage isSignedIn={authStatus === 'signed_in'} />} />
      <Route
        path="/login"
        element={
          authStatus === 'signed_in' ? (
            <Navigate to="/dashboard/overview" replace />
          ) : (
            <LoginPage
              walletAvailable={walletAvailable}
              signingIn={isSigningIn}
              checkingSession={authStatus === 'checking'}
              statusMessage={statusMessage}
              onConnect={() => void handleConnect()}
            />
          )
        }
      />
      <Route
        path="/dashboard/*"
        element={
          authStatus === 'checking' ? (
            <LoginPage
              walletAvailable={walletAvailable}
              signingIn={false}
              checkingSession
              statusMessage="Restoring your STPS workspace session."
              onConnect={() => undefined}
            />
          ) : authStatus !== 'signed_in' ? (
            <Navigate to="/login" replace />
          ) : (
            <main className="client-shell">
              <Rail
                sessionWallet={sessionWallet}
                onRefresh={() => void handleRefresh()}
                onLogout={() => void handleDisconnect()}
              />
              <section className="workspace-shell">
                <div className="workspace-toolbar">
                  <div className="toolbar-meta">
                    <span className="eyebrow">Private workspace</span>
                    <strong>{liveCount} live score{liveCount === 1 ? '' : 's'}</strong>
                  </div>
                </div>
                <Outlet />
              </section>
            </main>
          )
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route
          path="overview"
          element={
            <OverviewPage
              protocols={protocols}
              selectedProtocol={showEmptyWorkspace ? null : selected}
              selectedAddress={selectedAddress}
              onSelectProtocol={setSelectedAddress}
            />
          }
        />
        <Route
          path="protocols"
          element={
            <ProtocolsPage
              protocols={protocols}
              selectedProtocol={selected}
              selectedAddress={selectedAddress}
              claimAddress={claimAddress}
              claimLabel={claimLabel}
              claiming={claiming}
              onSelectProtocol={setSelectedAddress}
              onClaimAddressChange={setClaimAddress}
              onClaimLabelChange={setClaimLabel}
              onSubmitClaim={() => void handleClaim()}
            />
          }
        />
        <Route
          path="tokens"
          element={
            <TokensPage
              tokens={apiTokens}
              creating={creatingToken}
              revokingId={revokingTokenId}
              draftLabel={tokenLabel}
              revealedToken={revealedToken}
              onDraftLabelChange={setTokenLabel}
              onCreateToken={() => void handleCreateToken()}
              onDismissRevealedToken={() => setRevealedToken(null)}
              onRevokeToken={(tokenId) => void handleRevokeToken(tokenId)}
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
