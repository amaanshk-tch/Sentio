import { Networks } from "@stellar/stellar-sdk";

export const HORIZON_URL          = "https://horizon-testnet.stellar.org";
export const HORIZON_MAINNET_URL  = "https://horizon.stellar.org";

export const SOROBAN_RPC_URL =
  process.env.STELLAR_RPC_TESTNET_URL || "https://soroban-testnet.stellar.org";

export const SOROBAN_RPC_MAINNET_URL =
  process.env.STELLAR_RPC_MAINNET_URL || "https://soroban-rpc.mainnet.stellar.gateway.fm";

export const SOROBAN_NETWORK_PASSPHRASE = Networks.TESTNET;
