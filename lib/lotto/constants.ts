// Shared lotto economics + token-gating (safe for client and server).

/** Payout per winning number (5 winners × 0.2 SOL = 1 SOL per round). */
export const PAYOUT_SOL = 0.2;
export const PAYOUT_LAMPORTS = 200_000_000;

/** Minimum UI amount of the project token a wallet must hold to enter. */
export const MIN_TOKEN_HOLDING_UI = 100_000;

/** Display ticker for the project token. Cosmetic only. */
export const TOKEN_TICKER = "LOTTO";
