import { pipeline } from '../data/pipeline'

export function PipelinePanel() {
  return (
    <section className="pipeline-panel" id="pipeline" aria-label="Pipeline status">
      <div className="section-title">
        <span>Chain of custody</span>
        <strong>{pipeline.length} stages</strong>
      </div>
      <ol className="pipeline-list">
        {pipeline.map((step, index) => (
          <li key={step}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{step}</strong>
            <small>{index < pipeline.length - 1 ? 'Passing evidence forward' : 'Serving current state'}</small>
          </li>
        ))}
      </ol>
    </section>
  )
}
