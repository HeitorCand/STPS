#!/usr/bin/env node
/**
 * Gera uma nova keypair Solana e imprime:
 *   - O endereço público (pubkey)
 *   - O array de bytes para colocar em SCORING_AUTHORITY_KEYPAIR no .env
 *
 * Uso:
 *   node packages/scoring/scripts/generate-keypair.mjs
 *
 * Para também salvar como ~/.config/solana/id.json:
 *   node packages/scoring/scripts/generate-keypair.mjs --save
 */

import { Keypair } from "@solana/web3.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const shouldSave = args.includes("--save");

const kp = Keypair.generate();
const secretArray = Array.from(kp.secretKey);

console.log("");
console.log("=== Nova Scoring Authority Keypair ===");
console.log("");
console.log(`Pubkey:           ${kp.publicKey.toBase58()}`);
console.log("");
console.log("Para o .env do scoring (copie a linha inteira):");
console.log("");
console.log(`SCORING_AUTHORITY_KEYPAIR=${JSON.stringify(secretArray)}`);
console.log("");

if (shouldSave) {
  const dir = join(homedir(), ".config", "solana");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "id.json");
  writeFileSync(path, JSON.stringify(secretArray));
  console.log(`Salvo em ${path}`);
  console.log("");
}

console.log("Próximo passo: airdrop de SOL devnet para essa pubkey:");
console.log(`  curl -sS https://api.devnet.solana.com -X POST -H "Content-Type: application/json" \\`);
console.log(`    -d '{"jsonrpc":"2.0","id":1,"method":"requestAirdrop","params":["${kp.publicKey.toBase58()}",2000000000]}'`);
console.log("");
console.log("Em seguida verifique o saldo:");
console.log(`  curl -sS https://api.devnet.solana.com -X POST -H "Content-Type: application/json" \\`);
console.log(`    -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["${kp.publicKey.toBase58()}"]}'`);
console.log("");
