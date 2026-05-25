// Poll Solana for inbound deposits to pending number wallets.
// Used as a fallback when Helius webhooks cannot reach the app (e.g. localhost dev).
import "server-only";
import { PublicKey } from "@solana/web3.js";
import { sb } from "../supabase/server";
import { connection } from "../solana/connection";
import { RESERVATION_LAMPORTS } from "../lotto/constants";
import { handleDepositTransfer } from "./deposit-transfer";

export async function reconcilePendingDeposits(roundId: number): Promise<number> {
  const { data: pending } = await sb()
    .from("numbers")
    .select("id, deposit_address")
    .eq("round_id", roundId)
    .eq("status", "pending");

  if (!pending?.length) return 0;

  const conn = connection();
  let reserved = 0;

  for (const row of pending) {
    const addr = row.deposit_address as string;
    const sigs = await conn.getSignaturesForAddress(new PublicKey(addr), { limit: 8 });
    for (const s of sigs) {
      if (s.err) continue;
      const tx = await conn.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta || tx.meta.err) continue;

      const paidAtSec = tx.blockTime ?? undefined;
      const accountKeys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
      const destIdx = accountKeys.indexOf(addr);
      if (destIdx === -1) continue;

      const pre = tx.meta.preBalances[destIdx] ?? 0;
      const post = tx.meta.postBalances[destIdx] ?? 0;
      const received = post - pre;
      if (received !== RESERVATION_LAMPORTS) continue;

      // Find the signer that debited RESERVATION_LAMPORTS (simple heuristic).
      let from = accountKeys[0];
      for (let i = 0; i < accountKeys.length; i++) {
        const delta = (tx.meta.postBalances[i] ?? 0) - (tx.meta.preBalances[i] ?? 0);
        if (delta === -RESERVATION_LAMPORTS) {
          from = accountKeys[i];
          break;
        }
      }

      const outcome = await handleDepositTransfer({
        signature: s.signature,
        from,
        to: addr,
        amount: RESERVATION_LAMPORTS,
        paidAtSec,
      });
      if (outcome === "reserved") {
        reserved++;
        break;
      }
    }
  }

  return reserved;
}
