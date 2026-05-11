export function formatTime(value: number) {
  if (!Number.isFinite(value)) return 'Unknown'

  const date = new Date(value)
  const now = new Date()
  const isToday =
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()

  if (isToday) {
    return new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(date) + ' UTC'
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date) + ' UTC'
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
