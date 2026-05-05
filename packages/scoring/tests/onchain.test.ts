/**
 * Teste On-Chain — Devnet
 *
 * Testa `register_protocol` e `update_score` diretamente no programa Anchor
 * deployado na Devnet, sem passar pelo Indexer ou Scoring Engine.
 *
 * Para rodar:
 *   cd packages/scoring
 *   ANCHOR_PROGRAM_ID=FuAM2peBxYQgr4Sspd43FkYK7vuCZ5rTPxZYCnCSeCZk \
 *   SCORING_AUTHORITY_KEYPAIR='[183,21,...]' \
 *   node_modules/.bin/vitest run tests/onchain.test.ts --pool=forks
 */

import { describe, it, beforeAll, expect } from "vitest";
import anchorPkg from "@coral-xyz/anchor";
import type { Idl, Program as ProgramType } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { stpsIdl } from "../src/idl.js";
import { deriveCertificatePda } from "../src/on-chain.js";

const { AnchorProvider, BN, Program, Wallet } = anchorPkg;

// ── Configuração ──────────────────────────────────────────────────────────────

const PROGRAM_ID =
  process.env.ANCHOR_PROGRAM_ID ?? "FuAM2peBxYQgr4Sspd43FkYK7vuCZ5rTPxZYCnCSeCZk";
const RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

function loadKeypair(): Keypair {
  const raw = process.env.SCORING_AUTHORITY_KEYPAIR;
  if (!raw) throw new Error("SCORING_AUTHORITY_KEYPAIR não definida");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
}

function buildProgram(authority: Keypair): ProgramType {
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(stpsIdl as unknown as Idl, new PublicKey(PROGRAM_ID), provider);
}

// Protocolo único por run — evita colisão com PDAs já existentes na Devnet
const TEST_PROTOCOL = Keypair.generate().publicKey;

describe("On-Chain Devnet — register_protocol + update_score", { timeout: 60_000 }, () => {
  let program: ProgramType;
  let authority: Keypair;
  let certificatePda: PublicKey;

  beforeAll(() => {
    authority = loadKeypair();
    program = buildProgram(authority);
    [certificatePda] = deriveCertificatePda(TEST_PROTOCOL.toString());

    console.log("\n─────────────────────────────────────────────");
    console.log(`Program ID  : ${PROGRAM_ID}`);
    console.log(`RPC         : ${RPC_URL}`);
    console.log(`Authority   : ${authority.publicKey.toString()}`);
    console.log(`Protocol    : ${TEST_PROTOCOL.toString()}`);
    console.log(`Certificate : ${certificatePda.toString()}`);
    console.log("─────────────────────────────────────────────\n");
  });

  // ── 1. register_protocol ──────────────────────────────────────────────────

  it("register_protocol cria ProtocolCertificate com trust_score = 85", async () => {
    const sig = await program.methods
      .registerProtocol(TEST_PROTOCOL, 85)
      .accounts({
        authority: authority.publicKey,
        certificate: certificatePda,
        systemProgram: new PublicKey("11111111111111111111111111111111"),
      })
      .signers([authority])
      .rpc();

    console.log(`  ✓ register_protocol: ${sig}`);
    console.log(`    https://explorer.solana.com/tx/${sig}?cluster=devnet`);

    const cert = await (program.account as any).protocolCertificate.fetch(certificatePda);

    expect(cert.trustScore).toBe(85);
    expect(cert.authority.toString()).toBe(authority.publicKey.toString());
    expect(cert.protocolAddress.toString()).toBe(TEST_PROTOCOL.toString());
    expect(cert.riskFlags.toString()).toBe("0");
    const level = JSON.stringify(cert.riskLevel).toLowerCase();
    expect(level).toMatch(/low|medium/);
  });

  // ── 2. update_score — Medium ───────────────────────────────────────────────

  it("update_score para 65 com FLAG_MULTISIG_THRESHOLD_LOWERED", async () => {
    const FLAG = BigInt(1 << 1); // bit 1 = MULTISIG_THRESHOLD_LOWERED

    const sig = await program.methods
      .updateScore(65, new BN(FLAG.toString()))
      .accounts({
        authority: authority.publicKey,
        certificate: certificatePda,
      })
      .signers([authority])
      .rpc();

    console.log(`  ✓ update_score (65): ${sig}`);
    console.log(`    https://explorer.solana.com/tx/${sig}?cluster=devnet`);

    const cert = await (program.account as any).protocolCertificate.fetch(certificatePda);

    expect(cert.trustScore).toBe(65);
    expect(BigInt(cert.riskFlags.toString()) & FLAG).toBe(FLAG);
    const level = JSON.stringify(cert.riskLevel).toLowerCase();
    expect(level).toMatch(/medium|high/);
  });

  // ── 3. update_score — Critical ─────────────────────────────────────────────

  it("update_score para 38 com TIMELOCK+MULTISIG → RiskLevel Critical", async () => {
    const FLAGS = BigInt((1 << 0) | (1 << 1));

    const sig = await program.methods
      .updateScore(38, new BN(FLAGS.toString()))
      .accounts({
        authority: authority.publicKey,
        certificate: certificatePda,
      })
      .signers([authority])
      .rpc();

    console.log(`  ✓ update_score (38/Critical): ${sig}`);
    console.log(`    https://explorer.solana.com/tx/${sig}?cluster=devnet`);

    const cert = await (program.account as any).protocolCertificate.fetch(certificatePda);

    expect(cert.trustScore).toBe(38);
    const level = JSON.stringify(cert.riskLevel).toLowerCase();
    expect(level).toContain("critical");
  });

  // ── 4. Rejeições ───────────────────────────────────────────────────────────

  it("update_score com authority errada é rejeitado pelo programa", async () => {
    const wrongAuthority = Keypair.generate();

    await expect(
      program.methods
        .updateScore(99, new BN(0))
        .accounts({
          authority: wrongAuthority.publicKey,
          certificate: certificatePda,
        })
        .signers([wrongAuthority])
        .rpc(),
    ).rejects.toThrow(/Unauthorized|0x1770|custom program error/i);
  });

  it("update_score com score = 101 é rejeitado (InvalidScore)", async () => {
    await expect(
      program.methods
        .updateScore(101, new BN(0))
        .accounts({
          authority: authority.publicKey,
          certificate: certificatePda,
        })
        .signers([authority])
        .rpc(),
    ).rejects.toThrow(/InvalidScore|0x1771|custom program error/i);
  });
});
