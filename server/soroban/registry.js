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

const RPC_URL = process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const HORIZON_URL = process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
const CONTRACT_ID = process.env.RISK_REGISTRY_CONTRACT_ID;
const ADMIN_SECRET = process.env.SENTIO_ADMIN_SECRET;

const rpcServer = new rpc.Server(RPC_URL);

/**
 * Helper to fetch sequence number from Horizon since RPC doesn't natively expose it.
 */
async function loadAccount(accountId) {
  const res = await fetch(`${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}`);
  if (!res.ok) throw new Error("Could not load admin account sequence");
  const data = await res.json();
  return new Account(accountId, data.sequence);
}

/** 
 * Retrieves on-chain risk data from the RiskRegistry.
 */
export async function getOnchainRisk(address) {
  if (!CONTRACT_ID) return null;
  
  try {
    const contract = new Contract(CONTRACT_ID);
    
    // Simulate transaction to read state without needing a signature
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
          // Convert emitted ledger timestamp to JS milliseconds
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

/** 
 * Commits a calculated risk score back to the blockchain RiskRegistry.
 */
export async function setOnchainRisk(address, payload) {
  const { score, confidence = 50, category = "unknown" } = payload;
  
  if (!CONTRACT_ID || !ADMIN_SECRET) {
    return { success: false, reason: "No contract or admin key configured in environment" };
  }

  try {
    const adminKp = Keypair.fromSecret(ADMIN_SECRET);
    const contract = new Contract(CONTRACT_ID);
    
    // 1. Fetch sequence number
    const sourceAccount = await loadAccount(adminKp.publicKey());
    
    // 2. Build Transaction
    const tx = new TransactionBuilder(sourceAccount, {
      fee: "1000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(
        "set_risk",
        nativeToScVal(address, { type: 'address' }),
        nativeToScVal(score, { type: 'u32' }),
        nativeToScVal(confidence, { type: 'u32' }),
        nativeToScVal(category, { type: 'symbol' })
      ))
      .setTimeout(30)
      .build();

    // 3. Simulate to calculate resource fees and footprints
    const sim = await rpcServer.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      console.error("[Onchain] Simulation failed:", sim);
      return { success: false, reason: "Simulation failed" };
    }

    // 4. Assemble with footprints & sign
    // The assembleTransaction helper automatically attaches the Soroban authorization and fee payload
    const assembledTx = rpc.assembleTransaction(tx, NETWORK_PASSPHRASE, sim).build();
    assembledTx.sign(adminKp);

    // 5. Submit to network
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
