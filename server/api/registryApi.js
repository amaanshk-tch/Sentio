import { getOnchainHistory, getOnchainFlags, flagOnchain, setOnchainRisk } from "../soroban/registry.js";

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
  try {
    const history = await getOnchainHistory(address);
    return res.json({ history });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function flagsHandler(req, res) {
  const { address } = req.params;
  if (!address || !isValidAddress(address)) {
    return res.status(400).json({ error: "Invalid address format." });
  }
  try {
    const flags = await getOnchainFlags(address);
    return res.json({ flags });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function reportHandler(req, res) {
  const { address, reason, severity } = req.body;
  if (!address || !reason || severity === undefined) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  if (!isValidAddress(address)) {
    return res.status(400).json({ error: "Invalid address format." });
  }
  if (typeof reason !== "string" || reason.length > 64 || !/^[\w\s-]+$/.test(reason)) {
    return res.status(400).json({ error: "Reason must be alphanumeric, max 64 chars." });
  }
  const sev = Number(severity);
  if (!Number.isInteger(sev) || sev < 0 || sev > 100) {
    return res.status(400).json({ error: "Severity must be an integer 0-100." });
  }
  try {
    const secret = process.env.SENTIO_ADMIN_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "Server missing admin credentials." });
    }
    const result = await flagOnchain(secret, address, reason, sev);
    return result.success ? res.json(result) : res.status(400).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function setRiskHandler(req, res) {
  // Route is guarded by requireAdminToken in server/index.js
  // SENTIO_ADMIN_SECRET is read from env only — never from the request body
  const { address, score, confidence, category } = req.body;
  if (!address || score === undefined || confidence === undefined || !category) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  if (!isValidAddress(address)) {
    return res.status(400).json({ error: "Invalid address format." });
  }
  const s = Number(score), c = Number(confidence);
  if (!Number.isInteger(s) || s < 0 || s > 100) return res.status(400).json({ error: "Score must be 0-100." });
  if (!Number.isInteger(c) || c < 0 || c > 100) return res.status(400).json({ error: "Confidence must be 0-100." });
  if (typeof category !== "string" || category.length > 32 || !/^[\w-]+$/.test(category)) {
    return res.status(400).json({ error: "Category must be alphanumeric, max 32 chars." });
  }
  try {
    const result = await setOnchainRisk(address, { score: s, confidence: c, category });
    return result.success ? res.json(result) : res.status(400).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
