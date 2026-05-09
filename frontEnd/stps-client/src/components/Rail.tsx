import stpsLogo from '../../../stps_logo.svg'
import type { DataStatus } from '../types/stps'

type RailProps = {
  dataStatus: DataStatus
}

export function Rail({ dataStatus }: RailProps) {
  return (
    <aside className="rail" aria-label="STPS client navigation">
      <a className="rail-brand" href="/" aria-label="STPS dashboard">
        <img src={stpsLogo} alt="STPS" />
      </a>
      <nav className="rail-nav" aria-label="Dashboard sections">
        <a href="#overview" aria-current="page">Overview</a>
        <a href="#certificate">Certificate</a>
        <a href="#timeline">Timeline</a>
        <a href="#pipeline">Pipeline</a>
      </nav>
      <div className="rail-status">
        <span>Production</span>
        <strong data-state={dataStatus}>{dataStatus}</strong>
      </div>
    </aside>
  )
}
