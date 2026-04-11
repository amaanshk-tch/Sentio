import { Networks } from "@stellar/stellar-sdk";

// Stellar Horizon — always mainnet (real explorer data)
export const HORIZON_URL = "https://horizon.stellar.org";

// Soroban RPC — testnet (your contract lives here)
export const SOROBAN_RPC_URL = 
  process.env.STELLAR_RPC_TESTNET_URL || "https://soroban-testnet.stellar.org";

export const SOROBAN_NETWORK_PASSPHRASE = Networks.TESTNET;
