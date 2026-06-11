// Solana cluster helpers. Production mainnet is labeled "mainnet" in env;
// "mainnet-beta" is accepted only as a legacy alias (Solana's old RPC name).

export type SolanaCluster = "mainnet" | "devnet" | "testnet";

export function parseSolanaCluster(raw?: string): SolanaCluster {
  if (raw === "devnet") return "devnet";
  if (raw === "testnet") return "testnet";
  return "mainnet";
}

export function isDevnet(cluster: SolanaCluster): boolean {
  return cluster === "devnet";
}
