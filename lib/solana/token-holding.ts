// Server-side: check whether a wallet holds enough of the project token
// to be allowed to enter a round. Sums balances across both the classic
// SPL Token and the Token-2022 programs, since a project mint can live
// on either one.
import "server-only";
import { PublicKey } from "@solana/web3.js";
import { connection } from "./connection";
import { env } from "../env";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

export interface HoldingCheck {
  ok: boolean;
  uiAmount: number;
  required: number;
}

export async function verifyTokenHolding(walletAddress: string): Promise<HoldingCheck> {
  if (!env.LOTTO_TOKEN_MINT) {
    throw new Error("LOTTO_TOKEN_MINT is not configured");
  }

  const owner = new PublicKey(walletAddress);
  const mint = new PublicKey(env.LOTTO_TOKEN_MINT);
  const required = env.LOTTO_MIN_TOKEN_AMOUNT_UI;

  let total = 0;
  let okFromAnyProgram = false;
  const errors: string[] = [];

  for (const programId of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
    try {
      const resp = await connection().getParsedTokenAccountsByOwner(owner, { mint, programId });
      okFromAnyProgram = true;
      for (const acc of resp.value) {
        const parsed = (acc.account.data as {
          parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } };
        }).parsed;
        const ui = parsed?.info?.tokenAmount?.uiAmount;
        if (typeof ui === "number" && Number.isFinite(ui)) total += ui;
      }
    } catch (e) {
      errors.push(`${programId.toBase58()}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // If BOTH program lookups errored out, treat the whole check as failed —
  // we can't know whether the user holds the token or not. Surface the
  // underlying errors so the API caller can log them.
  if (!okFromAnyProgram) {
    throw new Error(`RPC lookups failed for both token programs: ${errors.join(" | ")}`);
  }

  return { ok: total >= required, uiAmount: total, required };
}
