const FLAG_EXPLANATIONS = {
  brand_new:            "This contract was deployed within the last 24 hours. Even legitimate projects carry extreme risk this fresh.",
  very_new:             "Less than 7 days old. No established track record — many scams launch and disappear in this window.",
  new_contract:         "The contract is less than a month old and has limited on-chain history to verify trustworthiness.",
  no_usage:             "No interactions detected in the last 24 hours. Unused contracts are harder to evaluate.",
  low_usage:            "Very few invocations detected. This contract hasn't been tested with real usage at scale.",
  unverified_deployer:  "The account that created this contract has no verified website (stellar.toml). Trusted teams always verify.",
  new_deployer:         "The deployer account is itself new — a pattern common in hit-and-run scam deployments.",
  event_burst:          "A sudden spike in contract activity was detected — this pattern matches exploit launches or spam campaigns.",
  admin_events:         "Admin-level actions were detected. This means one party has elevated control and could modify contract behavior.",
  low_diversity:        "Very few distinct accounts have called this contract. Real-world contracts attract diverse users.",
  concentrated_usage:   "Most calls come from a single account. This may indicate bot traffic rather than genuine adoption.",
};

export function buildInsights(flags) {
  return (Array.isArray(flags) ? flags : [])
    .map((f) => FLAG_EXPLANATIONS[f])
    .filter(Boolean);
}

export function buildSummary(data, risk) {
  const { contractType, invocationCount, uniqueCallers, ageDays, deployer } = data;
  const parts = [];

  const typeStr = contractType !== "Unknown" ? contractType.toLowerCase() : "smart";
  parts.push(`This appears to be a ${typeStr} contract on the Stellar network.`);

  if (ageDays === 0) parts.push("It was deployed today.");
  else if (ageDays < 7) parts.push(`It has been live for ${ageDays} day${ageDays !== 1 ? "s" : ""} — very recently deployed.`);
  else parts.push(`It has been on-chain for approximately ${ageDays} day${ageDays !== 1 ? "s" : ""}.`);

  if (invocationCount === 0) {
    parts.push("No recorded interactions were found in the recent scan window.");
  } else {
    parts.push(
      `It has been called ${invocationCount} time${invocationCount !== 1 ? "s" : ""} by ${uniqueCallers} unique account${uniqueCallers !== 1 ? "s" : ""} in the scanned period.`
    );
  }

  if (deployer?.deployerDomainVerified) {
    parts.push("The deployer has a verified domain, which increases legitimacy.");
  } else {
    parts.push("The deployer account has no verified domain — proceed with caution.");
  }

  return parts.join(" ");
}

export function buildRecommendation(score) {
  if (score < 30) return "Avoid interacting with this contract — multiple high-risk signals detected.";
  if (score < 70) return "Proceed with caution. Verify the deployer's identity and review the contract source before committing assets.";
  return "This contract shows healthy signals. Standard due diligence still applies before large transactions.";
}
