import { findNonceAccountsByAuthority } from "../clients/solana-rpc.js";
import {
  FLAG_MULTIPLE_ADMIN_NONCES,
  FLAG_PENDING_ADMIN_NONCE,
  L1_FLAGS_MASK,
} from "../flags.js";
import { logInfo } from "../logger.js";
import type { GovernanceEvent, LayerResult } from "../types.js";

/**
 * Layer 3 — Durable Nonce Watchdog
 *
 * Durable Nonces têm usos legítimos (multisigs offline, custodians air-gapped,
 * operações agendadas). Por isso, a L3 NÃO penaliza qualquer nonce pendente.
 *
 * Penaliza apenas quando há contexto de risco confirmado:
 *
 *   Condição A — Governança enfraquecida
 *     L1 já tem flags ativas (timelock removido, threshold reduzido, etc.)
 *
 *   Condição B — Transação de alto risco
 *     Evento corrente menciona permissões críticas: upgrade authority,
 *     withdraw authority ou fee vault.
 *
 * Sem condição de risco: registra como INFO no histórico (deduction=0).
 */

interface LayerThreeInput {
  protocolAddress: string;
  event: GovernanceEvent;
  /** Flags ativas (L1 + L2 + L3) já calculadas pelas camadas anteriores. */
  combinedFlags: bigint;
}

const HIGH_RISK_KEYWORDS = [
  "upgrade",
  "upgrade authority",
  "withdraw",
  "withdraw authority",
  "fee vault",
  "fee_vault",
  "fee receiver",
  "treasury",
];

export async function runLayer3({ protocolAddress, event, combinedFlags }: LayerThreeInput): Promise<LayerResult> {
  const result: LayerResult = {
    deduction: 0,
    flagsSet: 0n,
    flagsClear: 0n,
    alerts: [],
    status: "Healthy",
  };

  const adminKeys = resolveAdminKeys(protocolAddress);
  if (adminKeys.length === 0) {
    logInfo("layer3_no_admin_keys", { protocol_address: protocolAddress });
    return result;
  }

  // Coleta nonce accounts pendentes em todas as admin keys
  const allPending: string[] = [];
  for (const key of adminKeys) {
    const nonces = await findNonceAccountsByAuthority(key);
    for (const n of nonces) {
      if (n.state === "initialized" && n.nonce) {
        allPending.push(n.address);
      }
    }
  }

  if (allPending.length === 0) {
    result.flagsClear |= FLAG_PENDING_ADMIN_NONCE | FLAG_MULTIPLE_ADMIN_NONCES;
    return result;
  }

  // Avalia contexto de risco
  const governanceWeakened = (combinedFlags & L1_FLAGS_MASK) !== 0n;
  const highRiskTx = isHighRiskEvent(event);

  if (!governanceWeakened && !highRiskTx) {
    // Sem contexto de risco — registra como INFO, sem dedução.
    result.status = "Healthy";
    result.alerts.push({
      flag: "FLAG_PENDING_ADMIN_NONCE",
      message: `${allPending.length} nonce(s) admin pendente(s) — sem contexto de risco (INFO)`,
    });
    logInfo("layer3_pending_nonces_no_risk_context", {
      protocol_address: protocolAddress,
      pending_count: allPending.length,
    });
    return result;
  }

  // Contexto de risco confirmado — aplica dedução
  if (allPending.length >= 3) {
    result.flagsSet |= FLAG_MULTIPLE_ADMIN_NONCES;
    result.deduction -= 15;
    result.alerts.push({
      flag: "FLAG_MULTIPLE_ADMIN_NONCES",
      message: `${allPending.length} nonces admin pendentes em contexto de risco`,
    });
    result.status = "Critical";
  } else {
    result.flagsSet |= FLAG_PENDING_ADMIN_NONCE;
    result.deduction -= 5;
    result.alerts.push({
      flag: "FLAG_PENDING_ADMIN_NONCE",
      message: `${allPending.length} nonce(s) admin pendente(s) em contexto de risco`,
    });
    result.status = "Warning";
  }

  return result;
}

/**
 * Lê admin keys de um protocolo da env var `PROTOCOL_ADMIN_KEYS_MAP`.
 * Formato JSON: { "<protocol_address>": ["adminPubkey1", "adminPubkey2", ...] }
 */
function resolveAdminKeys(protocolAddress: string): string[] {
  const raw = process.env.PROTOCOL_ADMIN_KEYS_MAP;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const list = parsed[protocolAddress];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function isHighRiskEvent(event: GovernanceEvent): boolean {
  const haystack = [
    String(event.metadata.description ?? ""),
    String(event.metadata.heliusType ?? ""),
    JSON.stringify(event.metadata.accounts ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return HIGH_RISK_KEYWORDS.some((keyword) => haystack.includes(keyword));
}
