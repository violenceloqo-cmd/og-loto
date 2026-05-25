// SOL transfer helper with retry. Used for payouts, refunds, and sweeps.
import "server-only";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { connection } from "./connection";
import {
  PAYOUT_LAMPORTS,
  RESERVATION_LAMPORTS,
} from "../lotto/constants";

export const SOL = LAMPORTS_PER_SOL;
export { RESERVATION_LAMPORTS, PAYOUT_LAMPORTS };

export interface SendResult {
  signature: string;
}

/** Build, sign, and send a SOL transfer. Confirms at "confirmed" level. */
export async function sendSol(
  from: Keypair,
  toBase58: string,
  lamports: number,
  opts: { memo?: string } = {}
): Promise<SendResult> {
  if (lamports <= 0) throw new Error(`lamports must be positive, got ${lamports}`);
  const to = new PublicKey(toBase58);
  const conn = connection();

  const ixs: TransactionInstruction[] = [
    SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports }),
  ];
  if (opts.memo) {
    // SPL Memo program — optional
    const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
    ixs.push(
      new TransactionInstruction({
        keys: [],
        programId: MEMO,
        data: Buffer.from(opts.memo, "utf8"),
      })
    );
  }

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: from.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(...ixs);
  tx.sign(from);

  const signature = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return { signature };
}

/** Transfer ALL lamports out of `from`, leaving the account empty. Used for sweeps. */
export async function sweepAll(from: Keypair, toBase58: string): Promise<SendResult | null> {
  const conn = connection();
  const balance = await conn.getBalance(from.publicKey, "confirmed");
  // base tx fee on Solana is 5000 lamports per signature
  const fee = 5000;
  const sendable = balance - fee;
  if (sendable <= 0) return null; // nothing to sweep
  return sendSol(from, toBase58, sendable);
}
