// Solscan link + address formatting helpers. Safe for client and server.
import type { SolanaCluster } from "./solana/cluster";

export type { SolanaCluster };

function clusterQuery(cluster: SolanaCluster): string {
  if (cluster === "devnet") return "?cluster=devnet";
  if (cluster === "testnet") return "?cluster=testnet";
  return "";
}

export function solscanTx(signature: string, cluster: SolanaCluster): string {
  return `https://solscan.io/tx/${signature}${clusterQuery(cluster)}`;
}

export function solscanAddr(address: string, cluster: SolanaCluster): string {
  return `https://solscan.io/account/${address}${clusterQuery(cluster)}`;
}

/** Block explorer page for a Solana blockhash (used as the lotto draw seed). */
export function solscanBlock(blockhash: string, cluster: SolanaCluster): string {
  return `https://solscan.io/block/${blockhash}${clusterQuery(cluster)}`;
}

export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "—";
  if (addr.length <= 11) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function shortSig(sig: string | null | undefined): string {
  if (!sig) return "—";
  if (sig.length <= 11) return sig;
  return `${sig.slice(0, 4)}…${sig.slice(-4)}`;
}
