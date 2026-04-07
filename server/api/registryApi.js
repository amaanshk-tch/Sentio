import { getOnchainHistory, getOnchainFlags, flagOnchain, setOnchainRisk } from "../soroban/registry.js";

export async function historyHandler(req, res) {
  const { address } = req.params;
  if (!address) return res.status(400).json({ error: "Missing address" });
  
  try {
    const history = await getOnchainHistory(address);
    return res.json({ history });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function flagsHandler(req, res) {
  const { address } = req.params;
  if (!address) return res.status(400).json({ error: "Missing address" });
  
  try {
    const flags = await getOnchainFlags(address);
    return res.json({ flags });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function reportHandler(req, res) {
  const { secret, address, reason, severity } = req.body;
  if (!secret || !address || !reason || severity === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    const result = await flagOnchain(secret, address, reason, severity);
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function setRiskHandler(req, res) {
  // Uses admin key from env to set risk manually
  const { address, score, confidence, category } = req.body;
  if (!address || score === undefined || confidence === undefined || !category) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    const result = await setOnchainRisk(address, { score, confidence, category });
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
