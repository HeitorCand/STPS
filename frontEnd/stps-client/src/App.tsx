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
  requestVerificationChallenge,
  verifyAuthChallenge,
  verifyClaimControl,
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
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [sessionWallet, setSessionWallet] = useState<string | null>(null)
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([])
  const [tokenLabel, setTokenLabel] = useState('')
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [creatingToken, setCreatingToken] = useState(false)
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null)
  const [claimAddress, setClaimAddress] = useState('')
  const [claimLabel, setClaimLabel] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [verifyingAddress, setVerifyingAddress] = useState<string | null>(null)
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
    async (token: string | null, mode: 'initial' | 'refresh' = 'initial') => {
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
            ? 'Connect a wallet to access your protocol workspace.'
            : 'Install a Solana wallet to access your protocol workspace.',
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
            ? `Loaded ${managedProtocols.length} claimed protocol${managedProtocols.length === 1 ? '' : 's'} for your account`
            : 'Signed in. Claim a program address to create your first STPS workspace.',
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
    const storedToken = window.localStorage.getItem(SESSION_TOKEN_KEY)
    setSessionToken(storedToken)
    void loadWorkspace(storedToken, 'initial')
  }, [loadWorkspace])

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
      await loadWorkspace(session.token, 'refresh')
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
      await loadWorkspace(null, 'refresh')
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
    await loadWorkspace(sessionToken, 'refresh')
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
      setStatusMessage(`Claimed ${protocol.name}. Verify control to upgrade this workspace.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not claim protocol')
    } finally {
      setClaiming(false)
    }
  }, [claimAddress, claimLabel, sessionToken])

  const handleVerifySelected = useCallback(async () => {
    if (!sessionToken || !selected) return

    try {
      setVerifyingAddress(selected.address)
      const challenge = await requestVerificationChallenge(sessionToken, selected.id)
      const signature = await signUtf8Message(challenge.message)
      const response = await verifyClaimControl(sessionToken, selected.id, {
        challengeId: challenge.challengeId,
        signature,
      })
      const updated = toProtocol(response.claim)
      setProtocols((current) =>
        current.map((protocol) => (protocol.id === updated.id ? updated : protocol)),
      )
      setStatusMessage(
        updated.claimStatus === 'verified'
          ? `${updated.name} is now verified.`
          : `${updated.name} moved to manual review.`,
      )
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not verify protocol control')
    } finally {
      setVerifyingAddress(null)
    }
  }, [selected, sessionToken])

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
  const verifiedCount = protocols.filter((protocol) => protocol.claimStatus === 'verified').length

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
                    <strong>{verifiedCount} verified protocol{verifiedCount === 1 ? '' : 's'}</strong>
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
              verifying={verifyingAddress === selected?.address}
              onSelectProtocol={setSelectedAddress}
              onClaimAddressChange={setClaimAddress}
              onClaimLabelChange={setClaimLabel}
              onSubmitClaim={() => void handleClaim()}
              onVerifySelected={() => void handleVerifySelected()}
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
