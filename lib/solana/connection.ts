import "server-only";
import { Connection } from "@solana/web3.js";
import { rpcUrl } from "../env";

let cached: Connection | null = null;

export function connection(): Connection {
  if (!cached) cached = new Connection(rpcUrl(), "confirmed");
  return cached;
}
