// Treasury keypair loader (server-only).
import "server-only";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { env } from "../env";

let cached: Keypair | null = null;

export function treasury(): Keypair {
  if (cached) return cached;
  const raw = env.TREASURY_PRIVATE_KEY.trim();
  let secret: Uint8Array;
  if (raw.startsWith("[")) {
    secret = Uint8Array.from(JSON.parse(raw));
  } else {
    secret = bs58.decode(raw);
  }
  if (secret.length !== 64) {
    throw new Error(`TREASURY_PRIVATE_KEY must be 64 bytes (got ${secret.length})`);
  }
  cached = Keypair.fromSecretKey(secret);
  return cached;
}

export function treasuryAddress(): string {
  return treasury().publicKey.toBase58();
}

// Destination address for swept deposits. Defaults to the treasury if
// RECEIVE_WALLET_ADDRESS is not configured.
export function receiveAddress(): string {
  const raw = env.RECEIVE_WALLET_ADDRESS.trim();
  if (!raw) return treasuryAddress();
  try {
    return new PublicKey(raw).toBase58();
  } catch {
    throw new Error("RECEIVE_WALLET_ADDRESS is not a valid Solana address");
  }
}
