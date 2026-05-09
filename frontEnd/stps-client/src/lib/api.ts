import { INDEXER_API_URL, SCORING_API_URL } from './config'
import type {
  ApiAuthVerifyResponse,
  ApiChallengeResponse,
  ApiClaimResponse,
  ApiCreateTokenResponse,
  ApiManagedProtocolListResponse,
  ApiMeResponse,
  ApiTokenListResponse,
} from '../types/stps'

type JsonRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
  timeoutMs?: number
}

export async function fetchJson<T>(url: string, options: JsonRequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000)

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    const json = (await response.json().catch(() => null)) as T | null
    if (!response.ok) {
      const message =
        json && typeof json === 'object' && 'status' in json
          ? String(json.status)
          : `HTTP ${response.status}`
      throw new Error(message)
    }

    return json as T
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

export function requestAuthChallenge(walletAddress: string) {
  return fetchJson<ApiChallengeResponse>(`${SCORING_API_URL}/api/auth/challenge`, {
    method: 'POST',
    body: { walletAddress },
  })
}

export function verifyAuthChallenge(args: {
  challengeId: string
  walletAddress: string
  signature: string
}) {
  return fetchJson<ApiAuthVerifyResponse>(`${SCORING_API_URL}/api/auth/verify`, {
    method: 'POST',
    body: args,
  })
}

export function fetchMe(token: string) {
  return fetchJson<ApiMeResponse>(`${SCORING_API_URL}/api/me`, { token })
}

export function logout(token: string) {
  return fetchJson<{ status: string }>(`${SCORING_API_URL}/api/me/logout`, {
    method: 'POST',
    token,
  })
}

export function fetchManagedProtocols(token: string) {
  return fetchJson<ApiManagedProtocolListResponse>(`${SCORING_API_URL}/api/me/protocols`, { token })
}

export function claimProtocol(token: string, protocolAddress: string, label?: string) {
  return fetchJson<ApiClaimResponse>(`${SCORING_API_URL}/api/me/protocols/claim`, {
    method: 'POST',
    token,
    body: { protocolAddress, label },
  })
}

export function requestVerificationChallenge(token: string, claimId: string) {
  return fetchJson<ApiChallengeResponse>(
    `${SCORING_API_URL}/api/me/protocols/${claimId}/verification/challenge`,
    {
      method: 'POST',
      token,
    },
  )
}

export function verifyClaimControl(token: string, claimId: string, args: {
  challengeId: string
  signature: string
}) {
  return fetchJson<ApiClaimResponse>(
    `${SCORING_API_URL}/api/me/protocols/${claimId}/verification/verify`,
    {
      method: 'POST',
      token,
      body: args,
    },
  )
}

export function fetchApiTokens(token: string) {
  return fetchJson<ApiTokenListResponse>(`${SCORING_API_URL}/api/me/tokens`, {
    token,
  })
}

export function createApiToken(token: string, label?: string) {
  return fetchJson<ApiCreateTokenResponse>(`${SCORING_API_URL}/api/me/tokens`, {
    method: 'POST',
    token,
    body: label?.trim() ? { label: label.trim() } : {},
  })
}

export function revokeApiToken(token: string, tokenId: string) {
  return fetchJson<{ status: string }>(`${SCORING_API_URL}/api/me/tokens/${tokenId}`, {
    method: 'DELETE',
    token,
  })
}
