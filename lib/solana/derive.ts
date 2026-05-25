// HD derivation of per-round per-number keypairs.
// Path: m/44'/501'/{roundId}'/{n}'
// Deterministic: same (mnemonic, roundId, n) always yields the same address.
import "server-only";
import { Keypair } from "@solana/web3.js";
import { mnemonicToSeedSync } from "bip39";
import { derivePath } from "ed25519-hd-key";
import { env } from "../env";

let cachedSeed: Buffer | null = null;
function seed(): Buffer {
  if (!cachedSeed) cachedSeed = mnemonicToSeedSync(env.MASTER_MNEMONIC);
  return cachedSeed;
}

export function derivationPath(roundId: number | bigint, n: number): string {
  if (n < 1 || n > 100) throw new Error(`n must be 1..100, got ${n}`);
  if (Number(roundId) < 0) throw new Error(`roundId must be non-negative`);
  return `m/44'/501'/${roundId.toString()}'/${n}'`;
}

export function getNumberKeypair(roundId: number | bigint, n: number): Keypair {
  const { key } = derivePath(derivationPath(roundId, n), seed().toString("hex"));
  return Keypair.fromSeed(key);
}

export function getNumberAddress(roundId: number | bigint, n: number): string {
  return getNumberKeypair(roundId, n).publicKey.toBase58();
}

export function deriveAllForRound(roundId: number | bigint): Array<{ n: number; address: string; index: number }> {
  const out: Array<{ n: number; address: string; index: number }> = [];
  for (let n = 1; n <= 100; n++) {
    out.push({ n, address: getNumberAddress(roundId, n), index: n });
  }
  return out;
}
