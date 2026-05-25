import { describe, it, expect } from "vitest";
import { drawWinningNumbers, WINNERS_PER_ROUND } from "../lib/solana/randomness";

describe("drawWinningNumbers", () => {
  it(`returns ${WINNERS_PER_ROUND} distinct numbers in [1,100]`, () => {
    const out = drawWinningNumbers("7L9PqMxFXVT2sZ4yqDFAYRm8FvWuVA3uYGZP5nUq8z5j");
    expect(out).toHaveLength(WINNERS_PER_ROUND);
    expect(new Set(out).size).toBe(WINNERS_PER_ROUND);
    for (const n of out) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic for the same blockhash", () => {
    const a = drawWinningNumbers("samehash");
    const b = drawWinningNumbers("samehash");
    expect(a).toEqual(b);
  });

  it("produces different output for different blockhash", () => {
    const a = drawWinningNumbers("hash-a");
    const b = drawWinningNumbers("hash-b");
    expect(a).not.toEqual(b);
  });
});
