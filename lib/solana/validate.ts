import { PublicKey } from "@solana/web3.js";

export function isValidSolanaAddress(addr: string): boolean {
  try {
    const pk = new PublicKey(addr);
    return PublicKey.isOnCurve(pk.toBuffer());
  } catch {
    return false;
  }
}
