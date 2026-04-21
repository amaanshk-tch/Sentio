import { analyzeContract } from "../soroban/analyzer.js";
import { computeContractRisk } from "../soroban/contractRisk.js";
import { buildInsights, buildSummary, buildRecommendation } from "../soroban/insights.js";
import { cacheGet, cacheSet } from "../utils/cache.js";

export async function contractScanHandler(req, res) {
  try {
    const query = req.body?.contractId?.trim();
    if (!query) return res.status(400).json({ error: "Missing contractId" });
    if (!query.startsWith("C") || query.length !== 56) {
      return res.status(400).json({ error: "Invalid contract ID. Must start with 'C' and be 56 characters." });
    }

    const rawNetwork = req.body?.network;
    const network    = rawNetwork === "mainnet" ? "mainnet" : "testnet";

    const cacheKey = `${network}:contract:${query}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 14_000);
    try {
      const data     = await analyzeContract(query, { signal: controller.signal, network });
      const risk     = computeContractRisk(data);
      const insights = buildInsights(risk.flags);
      const summary  = buildSummary(data, risk);
      const rec      = buildRecommendation(risk.score);

      const result = {
        type: "contract",
        contractId: query,
        network,
        score: risk.score,
        risk: risk.risk,
        color: risk.color,
        flags: risk.flags,
        insights,
        recommendation: rec,
        summary,
        metadata: {
          ageDays: data.ageDays,
          contractType: data.contractType,
          deployer: data.deployer?.deployerAccount ?? null, // string or null
        },
        behavior: {
          invocationCount: data.invocationCount,
          eventCount: data.eventCount,
          uniqueCallers: data.uniqueCallers,
          dominantCallerRatio: data.dominantCallerRatio,
        },
        riskBreakdown: Object.fromEntries((risk.flags ?? []).map(f => [f, true])),
        events: {
          categories: data.eventCategories,
          raw: (data.rawEvents || []).map(e => ({
            // Whitelist only the fields you actually display in the UI
            ledger: typeof e.ledger === "number" ? e.ledger : null,
            txHash: typeof e.txHash === "string" ? e.txHash.slice(0, 64) : null,
            type:   typeof e.type   === "string" ? e.type.slice(0, 32) : null,
            // Do NOT forward e.value, e.topic raw objects — convert to strings first
            topic:  Array.isArray(e.topic) ? e.topic.map(t => String(t).slice(0, 64)) : [],
          }))
        },
        trend: {
          direction: risk.trend,
          history: risk.history,
        },
        confidence: risk.confidence,
      };

      cacheSet(cacheKey, result);
      return res.json(result);
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("[contract scan error]", err?.message);

    let status = 500;
    if (err?.status === 404) status = 404;

    let message = "Contract scan failed. Please try again.";
    if (err?.name === "AbortError") message = "Request timed out. Please try again.";
    if (err?.status === 404) message = err.message;

    return res.status(status).json({ error: message });
  }
}
