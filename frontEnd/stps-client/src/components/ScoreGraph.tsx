import { useMemo } from 'react'
import type { ScorePoint } from '../types/stps'

type ScoreGraphProps = {
  points: ScorePoint[]
}

export function ScoreGraph({ points }: ScoreGraphProps) {
  const graphPoints = useMemo(() => {
    if (points.length === 1) return '0,20 100,20'

    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * 100
        const y = 100 - point.score
        return `${x},${y}`
      })
      .join(' ')
  }, [points])

  return (
    <svg className="score-graph" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 0 80 H 100" />
      <path d="M 0 60 H 100" />
      <path d="M 0 40 H 100" />
      <polyline points={graphPoints} />
    </svg>
  )
}
