import { logError, logInfo } from "../logger.js";

/**
 * Cliente DeFiLlama com cache TTL para evitar rate limit.
 *
 * Endpoint público: https://api.llama.fi
 * - GET /protocol/:slug                → Detalhes do protocolo (TVL, chains, tokens)
 * - GET /summary/dexs/:protocol        → Volume de DEXs
 *
 * Implementa fallback gracioso: se a API falhar, retorna o último cache válido
 * (ou null se não houver cache) — nunca lança.
 */

const DEFAULT_CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const baseUrl = (process.env.DEFI_LLAMA_BASE_URL ?? "https://api.llama.fi").replace(/\/$/, "");
const ttlMs = (() => {
  const parsed = Number(process.env.DEFI_LLAMA_CACHE_TTL_SECONDS);
  if (Number.isFinite(parsed) && parsed > 0) return parsed * 1000;
  return DEFAULT_CACHE_TTL_MS;
})();

export interface DefiLlamaProtocol {
  id: string;
  name: string;
  symbol: string | null;
  chains: string[];
  tvl: number;
  chainTvls: Record<string, number>;
  tokens?: Array<{ symbol: string; address?: string; decimals?: number }>;
  /** Timestamp Unix em segundos do listing inicial. */
  listedAt?: number;
  raw?: unknown;
}

export async function fetchProtocol(slug: string): Promise<DefiLlamaProtocol | null> {
  const cacheKey = `protocol:${slug}`;
  const cached = readCache<DefiLlamaProtocol>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${baseUrl}/protocol/${slug}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      logError("defi_llama_http_error", `Status ${response.status}`, { slug });
      return readStale<DefiLlamaProtocol>(cacheKey);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const protocol = normalizeProtocol(json);
    if (!protocol) {
      return readStale<DefiLlamaProtocol>(cacheKey);
    }

    writeCache(cacheKey, protocol);
    logInfo("defi_llama_fetched", { slug, tvl: protocol.tvl });
    return protocol;
  } catch (error) {
    logError("defi_llama_fetch_failed", error, { slug });
    return readStale<DefiLlamaProtocol>(cacheKey);
  }
}

function normalizeProtocol(raw: Record<string, unknown>): DefiLlamaProtocol | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const name = typeof raw.name === "string" ? raw.name : null;
  if (!id || !name) return null;

  const chains = Array.isArray(raw.chains)
    ? (raw.chains.filter((c) => typeof c === "string") as string[])
    : [];
  const tvl =
    typeof raw.tvl === "number"
      ? raw.tvl
      : Array.isArray(raw.tvl) && raw.tvl.length > 0 && typeof (raw.tvl as Array<{ totalLiquidityUSD?: number }>)[(raw.tvl as unknown[]).length - 1]?.totalLiquidityUSD === "number"
        ? (raw.tvl as Array<{ totalLiquidityUSD: number }>)[(raw.tvl as unknown[]).length - 1].totalLiquidityUSD
        : 0;

  const chainTvls = (raw.chainTvls ?? {}) as Record<string, number>;
  const symbol = typeof raw.symbol === "string" ? raw.symbol : null;
  const listedAt = typeof raw.listedAt === "number" ? raw.listedAt : undefined;

  return {
    id,
    name,
    symbol,
    chains,
    tvl,
    chainTvls,
    listedAt,
    raw,
  };
}

function readCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.value as T;
}

function readStale<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return entry.value as T;
}

function writeCache<T>(key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearCache(): void {
  cache.clear();
}
