// Derive 9 distinct winning numbers in [1,100] from a Solana blockhash.
// Pure function — no I/O — so it's trivially testable.
import { createHash } from "node:crypto";

export const WINNERS_PER_ROUND = 9;

/**
 * Deterministic rejection-sampling:
 * - Hash the blockhash to a fresh 32-byte seed.
 * - For each pick, read the next 2 bytes as a uint16, modulo 100, +1.
 * - If already chosen, advance and re-hash for more entropy.
 */
export function drawWinningNumbers(blockhash: string, count = WINNERS_PER_ROUND): number[] {
  if (count > 100) throw new Error("count must be <= 100");
  const winners: number[] = [];
  let seed = createHash("sha256").update(blockhash).digest();
  let offset = 0;

  while (winners.length < count) {
    if (offset + 2 > seed.length) {
      seed = createHash("sha256").update(seed).digest();
      offset = 0;
    }
    const v = (seed[offset] << 8) | seed[offset + 1];
    offset += 2;
    // Rejection sampling to avoid modulo bias against the top of 65536/100
    const cap = 65500; // 65500 % 100 === 0
    if (v >= cap) continue;
    const pick = (v % 100) + 1;
    if (!winners.includes(pick)) winners.push(pick);
  }
  return winners;
}
