type ServiceStatusProps = {
  scoringOnline: boolean
  indexerOnline: boolean
  statusMessage: string
}

export function ServiceStatus({
  scoringOnline,
  indexerOnline,
  statusMessage,
}: ServiceStatusProps) {
  return (
    <section className="service-strip" aria-label="Production service status">
      <div>
        <span>Scoring Engine</span>
        <strong data-online={scoringOnline}>{scoringOnline ? 'Online' : 'Unavailable'}</strong>
      </div>
      <div>
        <span>Indexer</span>
        <strong data-online={indexerOnline}>{indexerOnline ? 'Online' : 'Unavailable'}</strong>
      </div>
      <p>{statusMessage}</p>
    </section>
  )
}
