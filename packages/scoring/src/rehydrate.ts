import anchorPkg from "@coral-xyz/anchor";
import type { Idl, Program as ProgramType } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { stpsIdl } from "./idl.js";
import { logError, logInfo } from "./logger.js";
import { deriveRiskLevel } from "./risk-level.js";
import { activeFlagNames } from "./flags.js";
import { hasProtocol, initProtocol, updateProtocol } from "./store.js";

const { AnchorProvider, BN, Program, Wallet } = anchorPkg;

/**
 * Rehydration on-chain — startup recovery
 *
 * Ao iniciar o Scoring Engine, busca todos os `ProtocolCertificate` PDAs cujo
 * `authority` é a keypair desta instância e repopula o store in-memory com os
 * dados persistidos on-chain.
 *
 * O que é recuperado:
 *   - trust_score
 *   - risk_flags (bitmask → FlagName[])
 *   - last_update (timestamp Unix em segundos — convertido para ms)
 *   - protocol_address
 *
 * O que NÃO é recuperado (não está on-chain):
 *   - history off-chain (o histórico começa vazio, com uma entrada de "rehydrated")
 *   - flagTimestamps granulares (emergencyKey TTL é reativado com `now`)
 *
 * Se DISABLE_ON_CHAIN=true ou se as vars de env estiverem ausentes, a função
 * retorna silenciosamente sem fazer I/O.
 */
export async function rehydrateStoreFromChain(): Promise<void> {
  if ((process.env.DISABLE_ON_CHAIN ?? "").toLowerCase() === "true") {
    logInfo("rehydrate_skipped", { reason: "DISABLE_ON_CHAIN=true" });
    return;
  }

  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const programIdStr = process.env.ANCHOR_PROGRAM_ID;
  const keypairRaw = process.env.SCORING_AUTHORITY_KEYPAIR;

  if (!programIdStr || !keypairRaw) {
    logInfo("rehydrate_skipped", { reason: "ANCHOR_PROGRAM_ID or SCORING_AUTHORITY_KEYPAIR not set" });
    return;
  }

  try {
    const bytes = JSON.parse(keypairRaw) as number[];
    const authority = Keypair.fromSecretKey(Uint8Array.from(bytes));
    const programId = new PublicKey(programIdStr);
    const connection = new Connection(rpcUrl, "confirmed");
    const wallet = new Wallet(authority);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = new Program(stpsIdl as unknown as Idl, programId, provider) as ProgramType;

    // Fetch all ProtocolCertificate accounts for this authority
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = await (program.account as any).protocolCertificate.all([
      {
        memcmp: {
          // authority field is at offset 8 (discriminator) + 0 = 8
          offset: 8,
          bytes: authority.publicKey.toBase58(),
        },
      },
    ]);

    if (accounts.length === 0) {
      logInfo("rehydrate_no_accounts", { authority: authority.publicKey.toBase58() });
      return;
    }

    const now = Date.now();
    let restored = 0;

    for (const { account } of accounts) {
      try {
        const protocolAddress: string = (account.protocolAddress as PublicKey).toBase58();
        const trustScore: number = account.trustScore as number;
        // risk_flags is a BN on-chain (u64)
        const riskFlagsBigint: bigint = BigInt((account.riskFlags as typeof BN.prototype).toString());
        // last_update is i64 (Unix seconds) on-chain
        const lastUpdateMs: number = Number((account.lastUpdate as typeof BN.prototype).toString()) * 1000;

        const riskLevel = deriveRiskLevel(trustScore);
        const flagNames = activeFlagNames(riskFlagsBigint);

        // Build flagTimestamps: for currently active flags we don't know the exact
        // original activation time (not stored on-chain), so we use `now`.
        // This is conservative for the emergency-key TTL — it will expire 72h from
        // the restart rather than 72h from the original use. Acceptable trade-off.
        const flagTimestamps: Record<string, number> = {};
        for (const flagName of flagNames) {
          flagTimestamps[flagName] = now;
        }

        if (!hasProtocol(protocolAddress)) {
          // Bootstrap with on-chain score; history starts with a "rehydrated" entry
          initProtocol(protocolAddress, trustScore, lastUpdateMs);
          updateProtocol(protocolAddress, {
            riskFlags: riskFlagsBigint,
            riskLevel,
            lastUpdate: lastUpdateMs,
            flagTimestamps,
          });
        }
        // If already in store (e.g. from a previous call), leave it untouched.

        restored++;
        logInfo("rehydrate_protocol_restored", {
          protocol_address: protocolAddress,
          trust_score: trustScore,
          risk_level: riskLevel,
          active_flags: flagNames,
        });
      } catch (entryError) {
        logError("rehydrate_protocol_failed", entryError, {
          account: String(account),
        });
      }
    }

    logInfo("rehydrate_complete", { restored, total: accounts.length });
  } catch (error) {
    // Rehydration failure must NEVER prevent the server from starting.
    // The engine falls back to empty state and resumes from scratch.
    logError("rehydrate_failed", error);
  }
}
