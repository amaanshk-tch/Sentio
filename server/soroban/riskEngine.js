
const scoreHistory = new Map();
const MAX_HISTORY = 20;

export function computeContractRisk(data) {
  const {
    ageDays, invocationCount, eventCount, uniqueCallers,
    dominantCallerRatio, eventPatternFlags, deployer,
    contractType,
  } = data;

  let score = 100;
  const factors = [];
  const flags   = [];

  function penalize(label, impact, reason) {
    score -= impact;
    factors.push({ label, impact: -impact, reason });
  }
  function bonus(label, impact, reason) {
    score += impact;
    factors.push({ label, impact: +impact, reason });
  }

  if (ageDays === 0) {
    penalize("Brand new contract", 30, "Deployed within the last 24 hours — extremely high risk window.");
    flags.push("brand_new");
  } else if (ageDays < 7) {
    penalize("Very new contract (< 7 days)", 22, "Recent deployments have no usage history to validate trust.");
    flags.push("very_new");
  } else if (ageDays < 30) {
    penalize("New contract (< 30 days)", 10, "Limited time on-chain — may not be battle-tested yet.");
    flags.push("new_contract");
  }

  if (invocationCount === 0) {
    penalize("No recorded invocations", 20, "This contract has never been called in the scanned period. Unverified in practice.");
    flags.push("no_usage");
  } else if (invocationCount < 5) {
    penalize("Very low invocation count", 12, `Only ${invocationCount} call(s) detected. Insufficient usage to establish trust.`);
    flags.push("low_usage");
  } else if (invocationCount > 100) {
    bonus("High invocation count", 8, "Well-used contracts are generally more scrutinized and trusted.");
  }

  if (!deployer?.deployerDomainVerified) {
    penalize("Unverified deployer domain", 15, "The account that deployed this contract has no verified stellar.toml domain.");
    flags.push("unverified_deployer");
  }
  if (deployer?.deployerAgeDays != null && deployer.deployerAgeDays < 30) {
    penalize("New deployer account", 10, "The deployer account itself is less than 30 days old — a common scam pattern.");
    flags.push("new_deployer");
  }

  if (eventPatternFlags.includes("event_burst")) {
    penalize("Event burst detected", 10, "A large spike in contract events was detected — common in exploit or spam campaigns.");
    flags.push("event_burst");
  }
  if (eventPatternFlags.includes("admin_events")) {
    penalize("Admin/upgrade events present", 15, "Events suggest admin privilege actions or contract upgrades — centralization risk.");
    flags.push("admin_events");
  }

  if (uniqueCallers === 0) {
    penalize("No distinct callers", 8, "No unique callers identified — the contract may not be publicly accessible.");
  } else if (uniqueCallers < 3) {
    penalize("Very low caller diversity", 12, `Only ${uniqueCallers} unique account(s) have interacted. Possible bot or test-only contract.`);
    flags.push("low_diversity");
  } else if (uniqueCallers > 20) {
    bonus("High caller diversity", 5, "Many unique callers suggest organic, real-world usage.");
  }

  if (dominantCallerRatio > 0.8 && invocationCount > 3) {
    penalize("Heavily concentrated usage", 8, "One account is responsible for most calls — may indicate bot activity.");
    flags.push("concentrated_usage");
  }
  if (contractType === "Unknown") {
    penalize("Unknown contract type", 5, "Could not classify contract behavior from events. Treat as unverified.");
  } else {
    bonus(`Contract type identified: ${contractType}`, 3, "Contract behavior matches known patterns, aiding analysis.");
  }

  score = Math.min(100, Math.max(0, Math.round(score)));

  const contractId = data.contractId;
  const history    = scoreHistory.get(contractId) ?? [];
  const prevScore  = history.length > 0 ? history[history.length - 1].score : null;
  const trend      = prevScore === null ? "stable" : score < prevScore - 2 ? "up" : score > prevScore + 2 ? "down" : "stable";

  const newHistory = [...history, { score, ts: Date.now() }].slice(-MAX_HISTORY);
  scoreHistory.set(contractId, newHistory);

  const risk   = score > 70 ? "Low Risk"    : score >= 40 ? "Medium Risk" : "High Risk";
  const color  = score > 70 ? "emerald"     : score >= 40 ? "amber"       : "rose";

  const signals = [ageDays != null, invocationCount != null, uniqueCallers != null,
                    deployer?.deployerDomainVerified !== undefined, eventCount > 0];
  const confidence = Math.round((signals.filter(Boolean).length / signals.length) * 100);

  return { score, risk, color, flags, factors, trend, history: newHistory, confidence };
}
