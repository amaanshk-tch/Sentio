import { 
  getOnchainHistory, 
  getOnchainFlags, 
  setOnchainRisk,
  buildFlagTransaction,
  buildSetRiskTransaction,
  submitSignedTransaction,
} from "../soroban/registry.js";

const ACCOUNT_RE = /^G[A-Z2-7]{55}$/;
const ASSET_RE   = /^[A-Z0-9]{1,12}:[A-Z2-7]{56}$/;

function isValidAddress(addr) {
  return ACCOUNT_RE.test(addr) || ASSET_RE.test(addr);
}

export async function historyHandler(req, res) {
  const { address } = req.params;
  if (!address || !isValidAddress(address)) {
    return res.status(400).json({ error: "Invalid address format." });
  }
  const targetAddress = ASSET_RE.test(address) ? address.split(":")[1] : address;
  try {
    const history = await getOnchainHistory(targetAddress);
    return res.json({ history });
  } catch (err) {
    console.error("[historyHandler error]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function flagsHandler(req, res) {
  const { address } = req.params;
  if (!address || !isValidAddress(address)) {
    return res.status(400).json({ error: "Invalid address format." });
  }
  const targetAddress = ASSET_RE.test(address) ? address.split(":")[1] : address;
  try {
    const flags = await getOnchainFlags(targetAddress);
    return res.json({ flags });
  } catch (err) {
    console.error("[flagsHandler error]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function reportHandler(req, res) {
  const { address, reason, severity, signerAddress } = req.body;
  if (!address || !reason || severity === undefined || !signerAddress) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  if (!isValidAddress(address)) {
    return res.status(400).json({ error: "Invalid address format." });
  }
  if (!ACCOUNT_RE.test(signerAddress)) {
    return res.status(400).json({ error: "Invalid signer address." });
  }
  if (typeof reason !== "string" || reason.length > 64 || !/^[\w\s-]+$/.test(reason)) {
    return res.status(400).json({ error: "Reason must be alphanumeric, max 64 chars." });
  }
  const sev = Number(severity);
  if (!Number.isInteger(sev) || sev < 0 || sev > 100) {
    return res.status(400).json({ error: "Severity must be an integer 0-100." });
  }

  const ADMIN_ADDRESS = process.env.SENTIO_ADMIN_ADDRESS;
  if (!ADMIN_ADDRESS) {
    return res.status(500).json({ error: "Server admin address not configured." });
  }
  if (signerAddress !== ADMIN_ADDRESS) {
    return res.status(403).json({ error: "Not authorized. Connected wallet is not the contract admin." });
  }

  const targetAddress = ASSET_RE.test(address) ? address.split(":")[1] : address;

  try {
    const unsignedXdr = await buildFlagTransaction(signerAddress, targetAddress, reason, sev);
    return res.json({ unsignedXdr });
  } catch (err) {
    console.error("[reportHandler error] buildFlagTransaction failed:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function setRiskHandler(req, res) {
  const { address, score, confidence, category, signerAddress } = req.body;
  if (!address || score === undefined || confidence === undefined || !category || !signerAddress) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  if (!isValidAddress(address)) {
    return res.status(400).json({ error: "Invalid address format." });
  }
  if (!ACCOUNT_RE.test(signerAddress)) {
    return res.status(400).json({ error: "Invalid signer address." });
  }
  const s = Number(score), c = Number(confidence);
  if (!Number.isInteger(s) || s < 0 || s > 100) return res.status(400).json({ error: "Score must be 0-100." });
  if (!Number.isInteger(c) || c < 0 || c > 100) return res.status(400).json({ error: "Confidence must be 0-100." });
  if (typeof category !== "string" || category.length > 32 || !/^[\w-]+$/.test(category)) {
    return res.status(400).json({ error: "Category must be alphanumeric, max 32 chars." });
  }

  const ADMIN_ADDRESS = process.env.SENTIO_ADMIN_ADDRESS;
  if (!ADMIN_ADDRESS) {
    return res.status(500).json({ error: "Server admin address not configured." });
  }
  if (signerAddress !== ADMIN_ADDRESS) {
    return res.status(403).json({ error: "Not authorized. Connected wallet is not the contract admin." });
  }

  const targetAddress = ASSET_RE.test(address) ? address.split(":")[1] : address;

  try {
    const unsignedXdr = await buildSetRiskTransaction(signerAddress, targetAddress, s, c, category);
    return res.json({ unsignedXdr });
  } catch (err) {
    console.error("[setRiskHandler error]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}

export async function submitHandler(req, res) {
  const { signedXdr } = req.body;
  if (!signedXdr) return res.status(400).json({ error: "Missing signedXdr." });
  try {
    const result = await submitSignedTransaction(signedXdr);
    return result.success ? res.json(result) : res.status(400).json(result);
  } catch (err) {
    console.error("[submitHandler error]", err);
    return res.status(500).json({ error: "Internal server error." });
  }
}