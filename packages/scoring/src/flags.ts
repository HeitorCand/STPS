/**
 * Bitmask `risk_flags` (u64) — espelha as constantes em
 * programs/stps/src/state/protocol_certificate.rs.
 *
 * Os valores aqui são `bigint` para permitir operações bitwise em todos os 64 bits
 * (JavaScript number só preserva 32 bits seguros para bitwise).
 */

export const FLAG_TIMELOCK_REMOVED            = 1n << 0n;
export const FLAG_MULTISIG_THRESHOLD_LOWERED  = 1n << 1n;
export const FLAG_UNKNOWN_SIGNER_ADDED        = 1n << 2n;
export const FLAG_EMERGENCY_KEY_USED          = 1n << 3n;
export const FLAG_WASH_TRADING_DETECTED       = 1n << 4n;
export const FLAG_LOW_LIQUIDITY_COLLATERAL    = 1n << 5n;
export const FLAG_NEW_TOKEN_COLLATERAL        = 1n << 6n;
export const FLAG_HIGH_HOLDER_CONCENTRATION   = 1n << 7n;
export const FLAG_PENDING_ADMIN_NONCE         = 1n << 8n;
export const FLAG_MULTIPLE_ADMIN_NONCES       = 1n << 9n;

export type FlagName =
  | "FLAG_TIMELOCK_REMOVED"
  | "FLAG_MULTISIG_THRESHOLD_LOWERED"
  | "FLAG_UNKNOWN_SIGNER_ADDED"
  | "FLAG_EMERGENCY_KEY_USED"
  | "FLAG_WASH_TRADING_DETECTED"
  | "FLAG_LOW_LIQUIDITY_COLLATERAL"
  | "FLAG_NEW_TOKEN_COLLATERAL"
  | "FLAG_HIGH_HOLDER_CONCENTRATION"
  | "FLAG_PENDING_ADMIN_NONCE"
  | "FLAG_MULTIPLE_ADMIN_NONCES";

export const FLAG_NAME_TO_BIT: Record<FlagName, bigint> = {
  FLAG_TIMELOCK_REMOVED,
  FLAG_MULTISIG_THRESHOLD_LOWERED,
  FLAG_UNKNOWN_SIGNER_ADDED,
  FLAG_EMERGENCY_KEY_USED,
  FLAG_WASH_TRADING_DETECTED,
  FLAG_LOW_LIQUIDITY_COLLATERAL,
  FLAG_NEW_TOKEN_COLLATERAL,
  FLAG_HIGH_HOLDER_CONCENTRATION,
  FLAG_PENDING_ADMIN_NONCE,
  FLAG_MULTIPLE_ADMIN_NONCES,
};

/** Bits que pertencem à L1 — usados pela L3 para detectar "governança enfraquecida". */
export const L1_FLAGS_MASK =
  FLAG_TIMELOCK_REMOVED |
  FLAG_MULTISIG_THRESHOLD_LOWERED |
  FLAG_UNKNOWN_SIGNER_ADDED |
  FLAG_EMERGENCY_KEY_USED;

export function activeFlagNames(flags: bigint): FlagName[] {
  return (Object.entries(FLAG_NAME_TO_BIT) as Array<[FlagName, bigint]>)
    .filter(([, bit]) => (flags & bit) !== 0n)
    .map(([name]) => name);
}
