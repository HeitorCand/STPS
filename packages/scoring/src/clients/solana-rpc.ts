import { Connection, PublicKey, NONCE_ACCOUNT_LENGTH, NonceAccount } from "@solana/web3.js";
import { logError, logInfo } from "../logger.js";

/**
 * Cliente RPC Solana para a Layer 3 (Durable Nonce Watchdog).
 *
 * Responsabilidades:
 * - Listar todas as nonce accounts cuja `authority` é uma das admin keys do protocolo
 * - Indicar quais estão "initialized" (tx pré-assinada pendente)
 *
 * Implementação:
 * - System Program owns as nonce accounts.
 * - O campo `authorizedPubkey` da NonceAccount fica nos bytes 8..40 do data layout.
 * - Usamos `getProgramAccounts` com filtros por dataSize e memcmp na authority.
 */

const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

let connection: Connection | null = null;

function getConnection(): Connection {
  if (connection) return connection;
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  connection = new Connection(rpcUrl, { commitment: "confirmed" });
  return connection;
}

export interface NonceAccountInfo {
  address: string;
  authority: string;
  state: "uninitialized" | "initialized";
  /** Hash do nonce atual; null se uninitialized. */
  nonce: string | null;
}

/**
 * Lista todas as nonce accounts cuja authority é a `adminKey` fornecida.
 *
 * Layout de uma nonce account inicializada (80 bytes total):
 *   [version: u32 (4)] [state: u32 (4)] [authority: Pubkey (32)] [nonce: Hash (32)] [feeCalc: 8]
 *
 * O offset 8 é onde começa a `authority` — usamos memcmp ali.
 */
export async function findNonceAccountsByAuthority(adminKey: string): Promise<NonceAccountInfo[]> {
  try {
    const conn = getConnection();
    const authorityPubkey = new PublicKey(adminKey);

    const accounts = await conn.getProgramAccounts(SYSTEM_PROGRAM_ID, {
      commitment: "confirmed",
      filters: [
        { dataSize: NONCE_ACCOUNT_LENGTH },
        { memcmp: { offset: 8, bytes: authorityPubkey.toBase58() } },
      ],
    });

    const result: NonceAccountInfo[] = [];
    for (const { pubkey, account } of accounts) {
      try {
        const parsed = NonceAccount.fromAccountData(account.data);
        const isInitialized = parsed.authorizedPubkey.toBase58() === authorityPubkey.toBase58();
        result.push({
          address: pubkey.toBase58(),
          authority: parsed.authorizedPubkey.toBase58(),
          state: isInitialized ? "initialized" : "uninitialized",
          nonce: parsed.nonce ?? null,
        });
      } catch (parseError) {
        logError("nonce_parse_failed", parseError, { address: pubkey.toBase58() });
      }
    }

    logInfo("nonce_accounts_found", { admin_key: adminKey, count: result.length });
    return result;
  } catch (error) {
    logError("solana_rpc_failed", error, { admin_key: adminKey });
    return [];
  }
}
