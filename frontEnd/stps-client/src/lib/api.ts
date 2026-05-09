import { INDEXER_API_URL, SCORING_API_URL } from './config'
import type { ApiProtocolListResponse } from '../types/stps'

export async function fetchJson<T>(url: string, timeoutMs = 8_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timeout)
  }
}

export function fetchScoringHealth() {
  return fetchJson<{ status: string }>(`${SCORING_API_URL}/health`)
}

export function fetchIndexerHealth() {
  return fetchJson<{ status: string }>(`${INDEXER_API_URL}/health`)
}

export function fetchProtocols() {
  return fetchJson<ApiProtocolListResponse>(`${SCORING_API_URL}/api/protocols`)
}
