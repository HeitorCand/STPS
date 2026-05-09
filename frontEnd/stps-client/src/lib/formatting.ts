export function formatTime(value: number) {
  if (!Number.isFinite(value)) return 'Unknown'

  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export function cleanReason(reason: string) {
  return reason.replace(/—/g, '-')
}

export function scoreDelta(previousScore: number | undefined, currentScore: number) {
  if (previousScore === undefined) return 'baseline'

  const delta = currentScore - previousScore
  if (delta > 0) return `+${delta}`

  return String(delta)
}
