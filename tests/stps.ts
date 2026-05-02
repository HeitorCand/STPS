import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Stps } from "../target/types/stps";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveProtocolCertificate(
  programId: PublicKey,
  protocolAddress: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stps"), Buffer.from("cert"), protocolAddress.toBuffer()],
    programId
  );
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("stps", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Stps as Program<Stps>;
  const authority = provider.wallet as anchor.Wallet;

  // Endereços fictícios para os testes
  const protocolAddress = Keypair.generate().publicKey;
  const wrongAuthority  = Keypair.generate();

  let certificatePda: PublicKey;
  let certificateBump: number;

  before(() => {
    [certificatePda, certificateBump] = deriveProtocolCertificate(
      program.programId,
      protocolAddress
    );
    console.log("Program ID:       ", program.programId.toBase58());
    console.log("Authority:        ", authority.publicKey.toBase58());
    console.log("Protocol address: ", protocolAddress.toBase58());
    console.log("Certificate PDA:  ", certificatePda.toBase58());
  });

  // -------------------------------------------------------------------------
  // register_protocol
  // -------------------------------------------------------------------------

  describe("register_protocol", () => {
    it("cria um ProtocolCertificate com score inicial 85", async () => {
      await program.methods
        .registerProtocol(protocolAddress, 85)
        .accounts({
          authority:     authority.publicKey,
          certificate:   certificatePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const cert = await program.account.protocolCertificate.fetch(certificatePda);

      assert.equal(cert.trustScore, 85, "trust_score deve ser 85");
      assert.deepEqual(cert.riskLevel, { low: {} }, "risk_level deve ser Low para score 85");
      assert.equal(cert.riskFlags.toNumber(), 0, "risk_flags deve ser 0 no registro");
      assert.ok(cert.authority.equals(authority.publicKey), "authority deve ser a wallet do provider");
      assert.ok(cert.protocolAddress.equals(protocolAddress), "protocol_address deve corresponder");
    });

    it("rejeita score inicial > 100", async () => {
      const anotherProtocol = Keypair.generate().publicKey;
      const [pda] = deriveProtocolCertificate(program.programId, anotherProtocol);

      try {
        await program.methods
          .registerProtocol(anotherProtocol, 101)
          .accounts({
            authority:     authority.publicKey,
            certificate:   pda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("Deveria ter lançado erro InvalidInitialScore");
      } catch (err: any) {
        assert.include(err.message, "InvalidInitialScore");
      }
    });
  });

  // -------------------------------------------------------------------------
  // update_score
  // -------------------------------------------------------------------------

  describe("update_score", () => {
    it("atualiza o score para 65 com flag MULTISIG_THRESHOLD_LOWERED", async () => {
      const FLAG_MULTISIG_THRESHOLD_LOWERED = new anchor.BN(1 << 1);

      await program.methods
        .updateScore(65, FLAG_MULTISIG_THRESHOLD_LOWERED)
        .accounts({
          authority:   authority.publicKey,
          certificate: certificatePda,
        })
        .rpc();

      const cert = await program.account.protocolCertificate.fetch(certificatePda);

      assert.equal(cert.trustScore, 65, "trust_score deve ser 65");
      assert.deepEqual(cert.riskLevel, { medium: {} }, "risk_level deve ser Medium para score 65");
      assert.equal(
        cert.riskFlags.toNumber(),
        FLAG_MULTISIG_THRESHOLD_LOWERED.toNumber(),
        "risk_flags deve ter o bit 1 ativo"
      );
    });

    it("atualiza o score para 38 com flags MULTISIG + TIMELOCK (Critical)", async () => {
      const flags = new anchor.BN((1 << 0) | (1 << 1)); // TIMELOCK_REMOVED | MULTISIG_THRESHOLD_LOWERED

      await program.methods
        .updateScore(38, flags)
        .accounts({
          authority:   authority.publicKey,
          certificate: certificatePda,
        })
        .rpc();

      const cert = await program.account.protocolCertificate.fetch(certificatePda);

      assert.equal(cert.trustScore, 38, "trust_score deve ser 38 — caso Drift");
      assert.deepEqual(cert.riskLevel, { critical: {} }, "risk_level deve ser Critical para score ≤ 40");
    });

    it("rejeita authority incorreta com Unauthorized", async () => {
      try {
        await program.methods
          .updateScore(100, new anchor.BN(0))
          .accounts({
            authority:   wrongAuthority.publicKey,
            certificate: certificatePda,
          })
          .signers([wrongAuthority])
          .rpc();
        assert.fail("Deveria ter lançado erro Unauthorized");
      } catch (err: any) {
        assert.include(err.message, "Unauthorized");
      }
    });

    it("rejeita score > 100 com InvalidScore", async () => {
      try {
        await program.methods
          .updateScore(101, new anchor.BN(0))
          .accounts({
            authority:   authority.publicKey,
            certificate: certificatePda,
          })
          .rpc();
        assert.fail("Deveria ter lançado erro InvalidScore");
      } catch (err: any) {
        assert.include(err.message, "InvalidScore");
      }
    });
  });

  // -------------------------------------------------------------------------
  // flag_alert
  // -------------------------------------------------------------------------

  describe("flag_alert", () => {
    it("ativa o bit FLAG_PENDING_ADMIN_NONCE (bit 8) com OR", async () => {
      const FLAG_PENDING_ADMIN_NONCE = new anchor.BN(1 << 8);

      const certBefore = await program.account.protocolCertificate.fetch(certificatePda);
      const flagsBefore = certBefore.riskFlags.toNumber();

      await program.methods
        .flagAlert(FLAG_PENDING_ADMIN_NONCE)
        .accounts({
          authority:   authority.publicKey,
          certificate: certificatePda,
        })
        .rpc();

      const certAfter = await program.account.protocolCertificate.fetch(certificatePda);
      const flagsAfter = certAfter.riskFlags.toNumber();

      assert.equal(
        flagsAfter,
        flagsBefore | FLAG_PENDING_ADMIN_NONCE.toNumber(),
        "risk_flags deve incluir o novo bit via OR"
      );
    });

    it("rejeita authority incorreta com Unauthorized", async () => {
      try {
        await program.methods
          .flagAlert(new anchor.BN(1 << 8))
          .accounts({
            authority:   wrongAuthority.publicKey,
            certificate: certificatePda,
          })
          .signers([wrongAuthority])
          .rpc();
        assert.fail("Deveria ter lançado erro Unauthorized");
      } catch (err: any) {
        assert.include(err.message, "Unauthorized");
      }
    });
  });

  // -------------------------------------------------------------------------
  // close_certificate
  // -------------------------------------------------------------------------

  describe("close_certificate", () => {
    it("fecha o ProtocolCertificate e devolve rent à authority", async () => {
      const balanceBefore = await provider.connection.getBalance(authority.publicKey);

      await program.methods
        .closeCertificate()
        .accounts({
          authority:     authority.publicKey,
          certificate:   certificatePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const balanceAfter = await provider.connection.getBalance(authority.publicKey);

      // A conta não deve mais existir
      const account = await provider.connection.getAccountInfo(certificatePda);
      assert.isNull(account, "A conta PDA deve ser null após o fechamento");

      // Balance deve ter aumentado (rent devolvido, menos gas)
      assert.isAbove(balanceAfter, balanceBefore - 10_000, "Rent deve ter sido devolvido");
    });

    it("rejeita authority incorreta com Unauthorized", async () => {
      // Registrar um novo certificado para este teste
      const newProtocol = Keypair.generate().publicKey;
      const [newPda] = deriveProtocolCertificate(program.programId, newProtocol);

      await program.methods
        .registerProtocol(newProtocol, 90)
        .accounts({
          authority:     authority.publicKey,
          certificate:   newPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      try {
        await program.methods
          .closeCertificate()
          .accounts({
            authority:     wrongAuthority.publicKey,
            certificate:   newPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([wrongAuthority])
          .rpc();
        assert.fail("Deveria ter lançado erro Unauthorized");
      } catch (err: any) {
        assert.include(err.message, "Unauthorized");
      }

      // Limpar: fechar o certificado corretamente
      await program.methods
        .closeCertificate()
        .accounts({
          authority:     authority.publicKey,
          certificate:   newPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });
  });
});
