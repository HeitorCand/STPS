import anchorPkg from "@coral-xyz/anchor";
import type { Idl, Program as ProgramType } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  type Commitment,
} from "@solana/web3.js";

const { AnchorProvider, BN, Program, Wallet } = anchorPkg;
import { stpsIdl } from "./idl.js";
import { logError, logInfo } from "./logger.js";

/**
 * Submissão on-chain do `update_score` (e `register_protocol` para bootstrap).
 *
 * Configuração via env:
 *   - SOLANA_RPC_URL              (URL do RPC; Helius recomendado)
 *   - ANCHOR_PROGRAM_ID           (program id do contrato STPS)
 *   - SCORING_AUTHORITY_KEYPAIR   (JSON array de bytes — keypair da authority)
 *   - DISABLE_ON_CHAIN            ('true' desativa para dev sem programa deployado)
 */

const COMMITMENT: Commitment = "confirmed";

interface UpdateScoreArgs {
  protocolAddress: string;
  newScore: number;
  newRiskFlags: bigint;
}

interface RegisterProtocolArgs {
  protocolAddress: string;
  initialScore: number;
}

let cachedProgram: ProgramType | null = null;
let cachedAuthority: Keypair | null = null;
let cachedProgramId: PublicKey | null = null;

function isDisabled(): boolean {
  return (process.env.DISABLE_ON_CHAIN ?? "").toLowerCase() === "true";
}

function loadAuthority(): Keypair {
  if (cachedAuthority) return cachedAuthority;
  const raw = process.env.SCORING_AUTHORITY_KEYPAIR;
  if (!raw) {
    throw new Error("SCORING_AUTHORITY_KEYPAIR is not set");
  }
  let bytes: number[];
  try {
    bytes = JSON.parse(raw) as number[];
  } catch {
    throw new Error("SCORING_AUTHORITY_KEYPAIR must be a JSON array of bytes");
  }
  if (!Array.isArray(bytes) || bytes.length !== 64) {
    throw new Error("SCORING_AUTHORITY_KEYPAIR must contain 64 bytes");
  }
  cachedAuthority = Keypair.fromSecretKey(Uint8Array.from(bytes));
  return cachedAuthority;
}

function loadProgramId(): PublicKey {
  if (cachedProgramId) return cachedProgramId;
  const id = process.env.ANCHOR_PROGRAM_ID;
  if (!id) throw new Error("ANCHOR_PROGRAM_ID is not set");
  cachedProgramId = new PublicKey(id);
  return cachedProgramId;
}

function getProgram(): ProgramType {
  if (cachedProgram) return cachedProgram;

  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, COMMITMENT);
  const wallet = new Wallet(loadAuthority());
  const provider = new AnchorProvider(connection, wallet, {
    commitment: COMMITMENT,
    preflightCommitment: COMMITMENT,
  });

  const programId = loadProgramId();
  cachedProgram = new Program(stpsIdl as unknown as Idl, programId, provider);
  return cachedProgram;
}

/**
 * Deriva o PDA `ProtocolCertificate` para um endereço de protocolo.
 * Seeds: ["stps", "cert", protocol_address]
 *
 * IMPORTANTE: o smart contract usa `b"cert"` (não `b"certificate"`) — ver
 * programs/stps/src/instructions/register_protocol.rs e update_score.rs.
 */
export function deriveCertificatePda(protocolAddress: string, programId?: PublicKey): [PublicKey, number] {
  const pid = programId ?? loadProgramId();
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stps"), Buffer.from("cert"), new PublicKey(protocolAddress).toBuffer()],
    pid,
  );
}

/**
 * Submete `update_score` on-chain.
 * Retorna a assinatura ou null em caso de erro/disabled.
 */
export async function submitScoreUpdate(args: UpdateScoreArgs): Promise<string | null> {
  if (isDisabled()) {
    logInfo("on_chain_disabled", { protocol_address: args.protocolAddress, new_score: args.newScore });
    return null;
  }

  try {
    const program = getProgram();
    const authority = loadAuthority();
    const [certificatePda] = deriveCertificatePda(args.protocolAddress);

    const sig = await program.methods
      .updateScore(args.newScore, new BN(args.newRiskFlags.toString()))
      .accounts({
        authority: authority.publicKey,
        certificate: certificatePda,
      })
      .signers([authority])
      .rpc();

    return sig;
  } catch (error) {
    logError("submit_score_update_failed", error, { protocol_address: args.protocolAddress });
    throw error;
  }
}

/**
 * Submete `register_protocol` on-chain.
 * Retorna a assinatura ou null em caso de disabled.
 */
export async function submitRegisterProtocol(args: RegisterProtocolArgs): Promise<string | null> {
  if (isDisabled()) {
    logInfo("on_chain_disabled", { protocol_address: args.protocolAddress, action: "register" });
    return null;
  }

  try {
    const program = getProgram();
    const authority = loadAuthority();
    const protocolPubkey = new PublicKey(args.protocolAddress);
    const [certificatePda] = deriveCertificatePda(args.protocolAddress);

    const sig = await program.methods
      .registerProtocol(protocolPubkey, args.initialScore)
      .accounts({
        authority: authority.publicKey,
        certificate: certificatePda,
        systemProgram: new PublicKey("11111111111111111111111111111111"),
      })
      .signers([authority])
      .rpc();

    return sig;
  } catch (error) {
    logError("submit_register_protocol_failed", error, { protocol_address: args.protocolAddress });
    throw error;
  }
}
