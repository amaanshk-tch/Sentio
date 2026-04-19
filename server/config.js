import { Networks } from "@stellar/stellar-sdk";

export const HORIZON_URL          = "https://horizon-testnet.stellar.org";
export const HORIZON_MAINNET_URL  = "https://horizon.stellar.org";

export const SOROBAN_RPC_URL =
  process.env.STELLAR_RPC_TESTNET_URL || "https://soroban-testnet.stellar.org";

export const SOROBAN_RPC_MAINNET_URL =
  process.env.STELLAR_RPC_MAINNET_URL || "https://soroban-rpc.mainnet.stellar.gateway.fm";

export const SOROBAN_NETWORK_PASSPHRASE = Networks.TESTNET;

export function getHorizonUrl(network = "testnet") {
  return network === "mainnet" ? HORIZON_MAINNET_URL : HORIZON_URL;
}

export function getSorobanRpcUrl(network = "testnet") {
  return network === "mainnet" ? SOROBAN_RPC_MAINNET_URL : SOROBAN_RPC_URL;
}

export function getNetworkPassphrase(network = "testnet") {
  return network === "mainnet" ? Networks.PUBLIC : SOROBAN_NETWORK_PASSPHRASE;
}

export function getContractId(network = "testnet") {
  if (network === "mainnet") {
    return process.env.RISK_REGISTRY_MAINNET_CONTRACT_ID || null;
  }
  return process.env.RISK_REGISTRY_CONTRACT_ID || null;
}
