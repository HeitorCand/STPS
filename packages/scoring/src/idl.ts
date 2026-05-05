/**
 * IDL minimal do programa STPS (programs/stps/src/lib.rs).
 *
 * Mantemos apenas as instruções e contas que o Scoring Engine precisa chamar:
 * - `register_protocol` — cria ProtocolCertificate PDA
 * - `update_score` — atualiza trust_score + risk_flags
 *
 * Quando o programa for buildado com `anchor build`, o IDL completo ficará em
 * `target/idl/stps.json`. Este IDL inline pode ser substituído por um import
 * desse JSON no futuro:
 *
 *   import idlJson from "../../../target/idl/stps.json" with { type: "json" };
 */

import type { Idl } from "@coral-xyz/anchor";

export const stpsIdl = {
  version: "0.1.0",
  name: "stps",
  instructions: [
    {
      name: "registerProtocol",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "certificate", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "protocolAddress", type: "publicKey" },
        { name: "initialScore", type: "u8" },
      ],
    },
    {
      name: "updateScore",
      accounts: [
        { name: "authority", isMut: false, isSigner: true },
        { name: "certificate", isMut: true, isSigner: false },
      ],
      args: [
        { name: "newScore", type: "u8" },
        { name: "newRiskFlags", type: "u64" },
      ],
    },
  ],
  accounts: [
    {
      name: "ProtocolCertificate",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "protocolAddress", type: "publicKey" },
          { name: "trustScore", type: "u8" },
          {
            name: "riskLevel",
            type: {
              defined: "RiskLevel",
            },
          },
          { name: "lastUpdate", type: "i64" },
          { name: "riskFlags", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  types: [
    {
      name: "RiskLevel",
      type: {
        kind: "enum",
        variants: [
          { name: "Low" },
          { name: "Medium" },
          { name: "High" },
          { name: "Critical" },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "Unauthorized", msg: "Unauthorized: signer is not the Scoring Authority for this certificate" },
    { code: 6001, name: "InvalidScore", msg: "Invalid score: trust_score must be between 0 and 100" },
    { code: 6002, name: "InvalidInitialScore", msg: "Invalid initial score: value must be between 0 and 100" },
    { code: 6003, name: "AlreadyRegistered", msg: "Protocol already registered: a certificate PDA exists for this address" },
    { code: 6004, name: "ArithmeticError", msg: "Arithmetic overflow or underflow" },
  ],
} as const satisfies Idl;
