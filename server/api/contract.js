import { analyzeContract } from "../soroban/analyzer.js";
import { computeContractRisk } from "../soroban/riskEngine.js";
import { buildInsights, buildSummary, buildRecommendation } from "../soroban/insights.js";
import { cacheGet, cacheSet } from "../utils/cache.js";
import { getOnchainRisk, setOnchainRisk } from "../soroban/registry.js";

/**
 * Express handler for POST /api/scan/contract (Soroban smart contracts)
 */
export async function contractScanHandler(req, res) {
  try {
    const query = req.body?.contractId?.trim();
    if (!query) return res.status(400).json({ error: "Missing contractId" });
    if (!query.startsWith("C") || query.length !== 56) {
      return res.status(400).json({ error: "Invalid contract ID. Must start with 'C' and be 56 characters." });
    }

    const cacheKey = `contract:${query}`;
    const cached   = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 14_000); // 14s timeout
    try {
      const onchainRiskPromise = getOnchainRisk(query);
      const data     = await analyzeContract(query, { signal: controller.signal });
      const risk     = computeContractRisk(data);
      const onchainData = await onchainRiskPromise;

      if (risk.score !== onchainData?.score) {
        setOnchainRisk(query, {
          score: risk.score,
          confidence: risk.confidence,
          category: risk.risk
        }).catch((e) => 
          console.error("[Sentio] On-chain risk logging failed:", e?.message)
        );
      }
      const insights = buildInsights(risk.flags);
      const summary  = buildSummary(data, risk);
      const rec      = buildRecommendation(risk.score);

      const result = {
        type: "contract",
        contractId: query,
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
          deployer: data.deployer,
        },
        behavior: {
          invocationCount: data.invocationCount,
          eventCount: data.eventCount,
          uniqueCallers: data.uniqueCallers,
          dominantCallerRatio: data.dominantCallerRatio,
        },
        riskBreakdown: risk.factors,
        events: {
          categories: data.eventCategories,
          raw: data.rawEvents,
        },
        trend: {
          direction: risk.trend,
          history: risk.history,
        },
        confidence: risk.confidence,
        onchainRiskData: onchainData,
      };

      cacheSet(cacheKey, result);
      return res.json(result);
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("[contract scan error]", err?.message);
    const status = err?.status === 404 ? 404 : 500;
    const message = err?.status === 404
      ? "Contract not found or has no activity."
      : err?.name === "AbortError"
        ? "Request timed out. Please try again."
        : "Contract scan failed. Please try again.";
    return res.status(status).json({ error: message });
  }
}
