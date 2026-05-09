const DEFAULT_SCORING_API_URL = 'https://stps-scoring-production.up.railway.app'
const DEFAULT_INDEXER_API_URL = 'https://stps-indexer-production.up.railway.app'

export const SCORING_API_URL = (
  import.meta.env.VITE_STPS_SCORING_API_URL ?? DEFAULT_SCORING_API_URL
).replace(/\/$/, '')

export const INDEXER_API_URL = (
  import.meta.env.VITE_STPS_INDEXER_API_URL ?? DEFAULT_INDEXER_API_URL
).replace(/\/$/, '')
