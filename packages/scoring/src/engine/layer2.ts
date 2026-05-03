import { fetchProtocol } from "../clients/defi-llama.js";
import {
  FLAG_HIGH_HOLDER_CONCENTRATION,
  FLAG_LOW_LIQUIDITY_COLLATERAL,
  FLAG_NEW_TOKEN_COLLATERAL,
  FLAG_WASH_TRADING_DETECTED,
} from "../flags.js";
import { logInfo } from "../logger.js";
import type { LayerResult } from "../types.js";

/**
 * Layer 2 — Asset Legitimacy
 *
 * Consulta DeFiLlama para avaliar a saúde dos ativos/colaterais do protocolo.
 *
 * Thresholds (alinhados com docs/architecture/SCORING_ALGORITHM.md):
 * - Wash trading: ratio volume suspeito / total > 0.7 → -20  (FLAG_WASH_TRADING_DETECTED)
 * - Liquidez:     TVL on-chain < $500.000              → -10  (FLAG_LOW_LIQUIDITY_COLLATERAL)
 * - Idade:        Token criado há < 30 dias            →  -8  (FLAG_NEW_TOKEN_COLLATERAL)
 * - Concentração: Top 10 wallets > 60% supply          → -12  (FLAG_HIGH_HOLDER_CONCENTRATION)
 *
 * Fallback gracioso: se DeFiLlama estiver indisponível, retorna LayerResult com
 * deduction=0 e status "Healthy" — nunca penaliza por instabilidade externa.
 */

const LIQUIDITY_THRESHOLD_USD = 500_000;
const NEW_TOKEN_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const WASH_TRADING_RATIO_THRESHOLD = 0.7;
const HOLDER_CONCENTRATION_THRESHOLD = 0.6;

export async function runLayer2(protocolAddress: string): Promise<LayerResult> {
  const result: LayerResult = {
    deduction: 0,
    flagsSet: 0n,
    flagsClear: 0n,
    alerts: [],
    status: "Healthy",
  };

  const slug = resolveDefiLlamaSlug(protocolAddress);
  if (!slug) {
    logInfo("layer2_no_slug_mapping", { protocol_address: protocolAddress });
    return result;
  }

  const protocol = await fetchProtocol(slug);
  if (!protocol) {
    logInfo("layer2_no_data", { protocol_address: protocolAddress, slug });
    return result;
  }

  // ---- Liquidez (TVL) ----
  if (protocol.tvl > 0 && protocol.tvl < LIQUIDITY_THRESHOLD_USD) {
    result.flagsSet |= FLAG_LOW_LIQUIDITY_COLLATERAL;
    result.deduction -= 10;
    result.alerts.push({
      flag: "FLAG_LOW_LIQUIDITY_COLLATERAL",
      message: `TVL on-chain abaixo de $${LIQUIDITY_THRESHOLD_USD.toLocaleString()} ($${protocol.tvl.toLocaleString()})`,
    });
  } else {
    result.flagsClear |= FLAG_LOW_LIQUIDITY_COLLATERAL;
  }

  // ---- Idade do protocolo / token ----
  if (protocol.listedAt) {
    const ageMs = Date.now() - protocol.listedAt * 1000;
    if (ageMs < NEW_TOKEN_AGE_MS) {
      result.flagsSet |= FLAG_NEW_TOKEN_COLLATERAL;
      result.deduction -= 8;
      result.alerts.push({
        flag: "FLAG_NEW_TOKEN_COLLATERAL",
        message: `Protocolo/colateral com menos de 30 dias (idade: ${Math.floor(ageMs / 86_400_000)}d)`,
      });
    } else {
      result.flagsClear |= FLAG_NEW_TOKEN_COLLATERAL;
    }
  }

  // ---- Wash trading & concentração de holders ----
  // DeFiLlama não expõe esses dados diretamente no endpoint /protocol.
  // Para o MVP, usamos heurísticas conservadoras a partir do payload disponível
  // e deixamos as integrações específicas (Birdeye / Helius enriched) como roadmap.
  const washRatio = readNumberFromRaw(protocol.raw, ["washTradingRatio", "wash_ratio"]);
  if (washRatio !== null && washRatio > WASH_TRADING_RATIO_THRESHOLD) {
    result.flagsSet |= FLAG_WASH_TRADING_DETECTED;
    result.deduction -= 20;
    result.alerts.push({
      flag: "FLAG_WASH_TRADING_DETECTED",
      message: `Ratio de wash trading: ${(washRatio * 100).toFixed(1)}%`,
    });
  } else {
    result.flagsClear |= FLAG_WASH_TRADING_DETECTED;
  }

  const top10Share = readNumberFromRaw(protocol.raw, ["top10HoldersShare", "holders_top10"]);
  if (top10Share !== null && top10Share > HOLDER_CONCENTRATION_THRESHOLD) {
    result.flagsSet |= FLAG_HIGH_HOLDER_CONCENTRATION;
    result.deduction -= 12;
    result.alerts.push({
      flag: "FLAG_HIGH_HOLDER_CONCENTRATION",
      message: `Top 10 holders controlam ${(top10Share * 100).toFixed(1)}% do supply`,
    });
  } else {
    result.flagsClear |= FLAG_HIGH_HOLDER_CONCENTRATION;
  }

  if (result.deduction <= -25) {
    result.status = "Critical";
  } else if (result.deduction < 0) {
    result.status = "Warning";
  }

  return result;
}

/**
 * Lê o mapeamento `protocol_address → DeFiLlama slug` da env var
 * `PROTOCOL_DEFILLAMA_MAP` (JSON inline).
 */
function resolveDefiLlamaSlug(protocolAddress: string): string | null {
  const raw = process.env.PROTOCOL_DEFILLAMA_MAP;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed[protocolAddress] ?? null;
  } catch {
    return null;
  }
}

function readNumberFromRaw(raw: unknown, keys: string[]): number | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}
