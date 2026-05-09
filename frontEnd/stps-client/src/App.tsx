import { useCallback, useEffect, useState } from 'react'
import { CertificatePanel } from './components/CertificatePanel'
import { FlagsPanel } from './components/FlagsPanel'
import { PipelinePanel } from './components/PipelinePanel'
import { ProtocolList } from './components/ProtocolList'
import { Rail } from './components/Rail'
import { ScorePanel } from './components/ScorePanel'
import { ScoreTimeline } from './components/ScoreTimeline'
import { ServiceStatus } from './components/ServiceStatus'
import { WorkspaceHeader } from './components/WorkspaceHeader'
import { mockProtocols } from './data/mockProtocols'
import { fetchIndexerHealth, fetchProtocols, fetchScoringHealth } from './lib/api'
import { toProtocol } from './lib/adapters'
import type { DataStatus, Protocol } from './types/stps'
import './App.css'

function App() {
  const [protocols, setProtocols] = useState<Protocol[]>(mockProtocols)
  const [selectedAddress, setSelectedAddress] = useState(mockProtocols[0].address)
  const [dataStatus, setDataStatus] = useState<DataStatus>('loading')
  const [statusMessage, setStatusMessage] = useState('Connecting to production Scoring Engine')
  const [scoringOnline, setScoringOnline] = useState(false)
  const [indexerOnline, setIndexerOnline] = useState(false)

  const loadDashboard = useCallback(async () => {
    await Promise.resolve()
    setDataStatus('loading')
    setStatusMessage('Connecting to production Scoring Engine')

    const [scoringHealthResult, indexerHealthResult] = await Promise.allSettled([
      fetchScoringHealth(),
      fetchIndexerHealth(),
    ])

    const scoringIsOnline =
      scoringHealthResult.status === 'fulfilled' && scoringHealthResult.value.status === 'ok'
    const indexerIsOnline =
      indexerHealthResult.status === 'fulfilled' && indexerHealthResult.value.status === 'ok'

    setScoringOnline(scoringIsOnline)
    setIndexerOnline(indexerIsOnline)

    try {
      const response = await fetchProtocols()
      const liveProtocols = response.protocols.map(toProtocol)

      if (liveProtocols.length === 0) {
        setProtocols(mockProtocols)
        setSelectedAddress(mockProtocols[0].address)
        setDataStatus('fallback')
        setStatusMessage('Production API is online but has no registered protocols yet')
        return
      }

      setProtocols(liveProtocols)
      setSelectedAddress((current) =>
        liveProtocols.some((protocol) => protocol.address === current)
          ? current
          : liveProtocols[0].address,
      )
      setDataStatus('live')
      setStatusMessage(
        `Loaded ${liveProtocols.length} protocol${liveProtocols.length === 1 ? '' : 's'} from production`,
      )
    } catch (error) {
      setProtocols(mockProtocols)
      setSelectedAddress(mockProtocols[0].address)
      setDataStatus('error')
      setStatusMessage(error instanceof Error ? error.message : 'Could not load production API')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const selected = protocols.find((protocol) => protocol.address === selectedAddress) ?? protocols[0]

  return (
    <main className="client-shell">
      <Rail dataStatus={dataStatus} />

      <section className="workspace" id="overview">
        <WorkspaceHeader onRefresh={() => void loadDashboard()} />
        <ServiceStatus
          scoringOnline={scoringOnline}
          indexerOnline={indexerOnline}
          statusMessage={statusMessage}
        />

        <div className="dashboard-grid">
          <ProtocolList
            protocols={protocols}
            selectedAddress={selected.address}
            onSelect={setSelectedAddress}
          />
          <ScorePanel protocol={selected} />
          <CertificatePanel protocol={selected} />
          <FlagsPanel protocol={selected} />
          <ScoreTimeline protocol={selected} />
          <PipelinePanel />
        </div>
      </section>
    </main>
  )
}

export default App
