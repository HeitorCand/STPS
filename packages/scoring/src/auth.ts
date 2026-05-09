import crypto from "node:crypto";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import type { ChallengePurpose } from "./onboarding-store.js";

const CHALLENGE_TTL_MINUTES = Number(process.env.AUTH_CHALLENGE_TTL_MINUTES ?? 10);
const SESSION_TTL_HOURS = Number(process.env.AUTH_SESSION_TTL_HOURS ?? 168);

export function assertSolanaAddress(value: string): string {
  return new PublicKey(value).toBase58();
}

export function buildChallengeMessage(args: {
  walletAddress: string;
  purpose: ChallengePurpose;
  protocolAddress?: string | null;
}): { message: string; expiresAt: string } {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MINUTES * 60_000);
  const nonce = crypto.randomUUID();
  const title =
    args.purpose === "login"
      ? "STPS wallet sign-in"
      : "STPS protocol control verification";

  const lines = [
    title,
    `Wallet: ${args.walletAddress}`,
    `Purpose: ${args.purpose}`,
    args.protocolAddress ? `Protocol: ${args.protocolAddress}` : null,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expires At: ${expiresAt.toISOString()}`,
    "Only sign this message if you trust the STPS dashboard.",
  ].filter(Boolean);

  return {
    message: lines.join("\n"),
    expiresAt: expiresAt.toISOString(),
  };
}

export function createSessionExpiryIso(): string {
  return new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60_000).toISOString();
}

export function verifyWalletSignature(args: {
  walletAddress: string;
  message: string;
  signatureBase64: string;
}): boolean {
  const signature = Buffer.from(args.signatureBase64, "base64");
  const messageBytes = new TextEncoder().encode(args.message);
  const publicKey = new PublicKey(args.walletAddress).toBytes();
  return nacl.sign.detached.verify(messageBytes, signature, publicKey);
}
