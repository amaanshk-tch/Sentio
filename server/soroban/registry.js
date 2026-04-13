import { 
  rpc, 
  TransactionBuilder, 
  Networks, 
  Keypair, 
  Contract, 
  nativeToScVal, 
  scValToNative, 
  Account
} from "@stellar/stellar-sdk";

import { SOROBAN_RPC_URL, SOROBAN_NETWORK_PASSPHRASE, HORIZON_URL } from "../config.js";

const RPC_URL = SOROBAN_RPC_URL;
const NETWORK_PASSPHRASE = SOROBAN_NETWORK_PASSPHRASE;
const CONTRACT_ID = process.env.RISK_REGISTRY_CONTRACT_ID;
const ADMIN_SECRET = process.env.SENTIO_ADMIN_SECRET;

// Testnet Horizon — contract ops use testnet accounts, not mainnet
const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";

const rpcServer = new rpc.Server(RPC_URL);

async function loadAccount(accountId) {
  const res = await fetch(`${TESTNET_HORIZON}/accounts/${encodeURIComponent(accountId)}`);
  if (!res.ok) throw new Error(`Could not load account ${accountId} from testnet Horizon (HTTP ${res.status})`);
  const data = await res.json();
  return new Account(accountId, data.sequence);
}

export async function getOnchainRisk(address) {
  if (!CONTRACT_ID) return null;
  
  try {
    const contract = new Contract(CONTRACT_ID);
    
    const tx = new TransactionBuilder(new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"), { 
      fee: "100", 
      networkPassphrase: NETWORK_PASSPHRASE 
    })
      .addOperation(contract.call("get_risk", nativeToScVal(address, { type: 'address' })))
      .setTimeout(30)
      .build();

    const sim = await rpcServer.simulateTransaction(tx);
    
    if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
      if (!sim.result.retval) return null;
      
      const val = scValToNative(sim.result.retval);
      if (val) {
        return {
          score: Number(val.score),
          confidence: Number(val.confidence),
          category: val.category ? val.category.toString() : "",
          last_updated: Number(val.last_updated) * 1000 
        };
      }
    }
    return null;
  } catch (err) {
    console.warn("[Onchain] get_risk failed:", err.message);
    return null;
  }
}

export async function setOnchainRisk(address, payload) {
  const { score, confidence = 50, category = "unknown" } = payload;
  
  if (!CONTRACT_ID || !ADMIN_SECRET) {
    return { success: false, reason: "No contract or admin key configured in environment" };
  }

  try {
    const adminKp = Keypair.fromSecret(ADMIN_SECRET);
    const contract = new Contract(CONTRACT_ID);
    
    const sourceAccount = await loadAccount(adminKp.publicKey());
    
    const tx = new TransactionBuilder(sourceAccount, {
      fee: "1000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(
        "set_risk",
        nativeToScVal(address, { type: 'address' }),
        nativeToScVal(score, { type: 'u32' }),
        nativeToScVal(confidence, { type: 'u32' }),
        nativeToScVal(category, { type: 'string' })
      ))
      .setTimeout(30)
      .build();

    const sim = await rpcServer.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      console.error("[Onchain] Simulation failed:", sim);
      return { success: false, reason: "Simulation failed" };
    }

    const assembledTx = rpc.assembleTransaction(tx, sim).build();
    assembledTx.sign(adminKp);

    const response = await rpcServer.sendTransaction(assembledTx);
    if (response.status === "PENDING" || response.status === "SUCCESS") {
      return { success: true, hash: response.hash };
    }
    
    return { success: false, reason: response.status };
  } catch (err) {
    console.error("[Onchain] set_risk failed:", err.message);
    return { success: false, reason: err.message };
  }
}

export async function getOnchainHistory(address) {
  if (!CONTRACT_ID) return [];
  
  try {
    const contract = new Contract(CONTRACT_ID);
    const tx = new TransactionBuilder(new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"), { 
      fee: "100", 
      networkPassphrase: NETWORK_PASSPHRASE 
    })
      .addOperation(contract.call("get_history", nativeToScVal(address, { type: 'address' })))
      .setTimeout(30)
      .build();

    const sim = await rpcServer.simulateTransaction(tx);
    
    if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
      if (!sim.result.retval) return [];
      
      const val = scValToNative(sim.result.retval);
      if (Array.isArray(val)) {
        return val.map(item => ({
          score: Number(item.score),
          confidence: Number(item.confidence),
          category: item.category ? item.category.toString() : "",
          last_updated: Number(item.last_updated) * 1000 
        })).reverse(); // Contract returns oldest->newest (chronological). We reverse for UI (newest first).
      }
    }
    return [];
  } catch (err) {
    console.warn("[Onchain] get_history failed:", err.message);
    return [];
  }
}

export async function flagOnchain(adminSecret, address, reason, severity) {
  if (!CONTRACT_ID) return { success: false, reason: "No contract configured" };

  try {
    const adminKp = Keypair.fromSecret(adminSecret);
    const contract = new Contract(CONTRACT_ID);
    
    const sourceAccount = await loadAccount(adminKp.publicKey());
    
    const tx = new TransactionBuilder(sourceAccount, {
      fee: "1000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(
        "flag",
        nativeToScVal(address, { type: 'address' }),
        nativeToScVal(reason, { type: 'string' }),
        nativeToScVal(severity, { type: 'u32' })
      ))
      .setTimeout(30)
      .build();

    const sim = await rpcServer.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      console.error("[Onchain] flag Simulation failed:", sim);
      return { success: false, reason: "Simulation failed" };
    }

    const assembledTx = rpc.assembleTransaction(tx, sim).build();
    assembledTx.sign(adminKp);

    const response = await rpcServer.sendTransaction(assembledTx);
    if (response.status === "PENDING" || response.status === "SUCCESS") {
      return { success: true, hash: response.hash };
    }
    
    return { success: false, reason: response.status };
  } catch (err) {
    console.error("[Onchain] flag failed:", err.message);
    return { success: false, reason: err.message };
  }
}

export async function getOnchainFlags(address) {
  if (!CONTRACT_ID) return [];
  
  try {
    const contract = new Contract(CONTRACT_ID);
    const tx = new TransactionBuilder(new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"), { 
      fee: "100", 
      networkPassphrase: NETWORK_PASSPHRASE 
    })
      .addOperation(contract.call("get_flags", nativeToScVal(address, { type: 'address' })))
      .setTimeout(30)
      .build();

    const sim = await rpcServer.simulateTransaction(tx);
    
    if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
      if (!sim.result.retval) return [];
      const val = scValToNative(sim.result.retval);
      if (Array.isArray(val)) {
        return val.map(item => ({
          reason: item.reason ? item.reason.toString() : "",
          severity: Number(item.severity),
          timestamp: Number(item.timestamp) * 1000 
        })).reverse(); // Contract returns oldest->newest. Reverse for UI rendering.
      }
    }
    return [];
  } catch (err) {
    console.warn("[Onchain] get_flags failed:", err.message);
    return [];
  }
}

// ─── Freighter-compatible: build unsigned transactions ────────────────────────

export async function buildFlagTransaction(signerAddress, address, reason, severity) {
  if (!CONTRACT_ID) throw new Error("No contract configured.");
  const contract = new Contract(CONTRACT_ID);
  
  console.log("[buildFlag] Loading account:", signerAddress);
  const sourceAccount = await loadAccount(signerAddress);
  console.log("[buildFlag] Account loaded, sequence:", sourceAccount.sequence);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "1000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(
      "flag",
      nativeToScVal(address, { type: "address" }),
      nativeToScVal(reason, { type: "string" }),
      nativeToScVal(severity, { type: "u32" })
    ))
    .setTimeout(30)
    .build();

  console.log("[buildFlag] Simulating transaction...");
  const sim = await rpcServer.simulateTransaction(tx);
  console.log("[buildFlag] Simulation status:", JSON.stringify({
    isSuccess: rpc.Api.isSimulationSuccess(sim),
    hasResult: !!sim.result,
    hasAuth: !!sim.result?.auth,
    keys: Object.keys(sim),
  }));
  
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error("Simulation failed: " + JSON.stringify(sim));
  }

  console.log("[buildFlag] Assembling transaction...");
  try {
    const assembled = rpc.assembleTransaction(tx, sim).build();
    console.log("[buildFlag] Assembly succeeded");
    return assembled.toXDR();
  } catch (assembleErr) {
    console.error("[buildFlag] assembleTransaction crashed:", assembleErr);
    console.error("[buildFlag] Full sim result:", JSON.stringify(sim, null, 2));
    throw assembleErr;
  }
}

export async function buildSetRiskTransaction(signerAddress, address, score, confidence, category) {
  if (!CONTRACT_ID) throw new Error("No contract configured.");
  const contract = new Contract(CONTRACT_ID);
  const sourceAccount = await loadAccount(signerAddress);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "1000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(
      "set_risk",
      nativeToScVal(address, { type: "address" }),
      nativeToScVal(score, { type: "u32" }),
      nativeToScVal(confidence, { type: "u32" }),
      nativeToScVal(category, { type: "string" })
    ))
    .setTimeout(30)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error("Simulation failed: " + JSON.stringify(sim));
  }

  const assembled = rpc.assembleTransaction(tx, sim).build();
  return assembled.toXDR(); // unsigned — Freighter will sign this
}

export async function submitSignedTransaction(signedXdr) {
  try {
    const { TransactionBuilder: TB } = await import("@stellar/stellar-sdk");
    const tx = TB.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const response = await rpcServer.sendTransaction(tx);
    if (response.status === "PENDING" || response.status === "SUCCESS") {
      return { success: true, hash: response.hash };
    }
    return { success: false, reason: response.status };
  } catch (err) {
    console.error("[Onchain] submit failed:", err.message);
    return { success: false, reason: err.message };
  }
}