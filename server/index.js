import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || "https://horizon.stellar.org";

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function scoreLabel(score) {
  if (score > 70) return "Low Risk";
  if (score >= 40) return "Medium Risk";
  return "High Risk";
}

function scoreColor(score) {
  if (score > 70) return "emerald";
  if (score >= 40) return "amber";
  return "rose";
}

function isLikelyStellarAccount(s) {
  return typeof s === "string" && /^G[A-Z2-7]{55}$/.test(s.trim());
}

function parseAsset(s) {
  if (typeof s !== "string") return null;
  const trimmed = s.trim();
  const idx = trimmed.indexOf(":");
  if (idx === -1) return null;
  const code = trimmed.slice(0, idx).trim();
  const issuer = trimmed.slice(idx + 1).trim();
  if (!code || !issuer) return null;
  if (!/^[A-Za-z0-9]{1,12}$/.test(code)) return null;
  if (!isLikelyStellarAccount(issuer)) return null;
  return { code, issuer, raw: trimmed };
}

async function fetchJson(url, { signal } = {}) {
  const res = await fetch(url, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res.json();
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { accept: "text/plain,application/octet-stream,*/*" },
    });
  } finally {
    clearTimeout(t);
  }
}

async function verifyHomeDomain(homeDomain) {
  if (!homeDomain) return { homeDomain: null, verified: false };
  const domain = String(homeDomain).trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!domain || domain.includes(" ") || domain.includes("@")) return { homeDomain: domain || null, verified: false };

  const url = `https://${domain}/.well-known/stellar.toml`;
  try {
    const res = await fetchWithTimeout(url, 3000);
    if (!res.ok) return { homeDomain: domain, verified: false };
    const text = await res.text();
    const looksLikeToml = /^(#|\s*VERSION|\s*NETWORK_PASSPHRASE|\s*SIGNING_KEY|\s*ACCOUNTS)/m.test(text);
    return { homeDomain: domain, verified: looksLikeToml || text.length > 0 };
  } catch {
    return { homeDomain: domain, verified: false };
  }
}

function computeRisk({ ageDays, txRecentCount, trustlinesCount, domainVerified, flags, isAsset, assetSupply }) {
  let score = 100;
  const reasons = [];

  if (ageDays != null) {
    if (ageDays < 14) {
      score -= 30;
      reasons.push("New account (created < 14 days)");
    } else if (ageDays < 90) {
      score -= 10;
      reasons.push("Young account (created < 90 days)");
    }
  }

  if (txRecentCount != null) {
    if (txRecentCount < 5) {
      score -= 20;
      reasons.push("Very low recent activity");
    } else if (txRecentCount < 25) {
      score -= 10;
      reasons.push("Low recent activity");
    }
  }

  if (!domainVerified) {
    score -= 20;
    reasons.push("No verified home domain (stellar.toml missing)");
  }

  if (trustlinesCount != null && trustlinesCount === 0 && !isAsset) {
    score -= 8;
    reasons.push("No trustlines");
  }

  const flagList = Array.isArray(flags) ? flags : [];
  if (flagList.includes("auth_required")) {
    score -= 6;
    reasons.push("Authorization required flag enabled");
  }
  if (flagList.includes("clawback_enabled")) {
    score -= 10;
    reasons.push("Clawback enabled flag present");
  }
  if (flagList.includes("auth_revocable")) {
    score -= 4;
  }

  if (isAsset && typeof assetSupply === "number") {
    if (assetSupply > 600_000_000) {
      score -= 10;
      reasons.push("High asset supply");
    }
  }

  score = clamp(score, 0, 100);
  const risk = scoreLabel(score);
  const color = scoreColor(score);
  if (!reasons.length) reasons.push("No critical indicators detected");

  const insight =
    score < 40
      ? "This entity shows multiple higher-risk indicators (newness, limited activity, and missing identity signals). Exercise caution and verify counterparties."
      : score < 70
        ? "This entity has mixed signals. Review domain verification, account maturity, and activity patterns before interacting."
        : "This entity shows generally healthy signals. Continue monitoring for changes in flags, domain status, and activity.";

  return { score, risk, color, reasons, insight };
}

app.post("/api/scan", async (req, res) => {
  try {
    const body = req.body || {};
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) return res.status(400).json({ error: "Missing query" });

    const asset = parseAsset(query);
    const isAsset = Boolean(asset);

    if (!isAsset && !isLikelyStellarAccount(query)) {
      return res.status(400).json({ error: "Invalid input. Use a Stellar account (G...) or CODE:ISSUER." });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const signal = controller.signal;

    try {
      let address = query;
      let accountId = query;
      let assetSupply = null;

      if (isAsset) {
        address = asset.raw;
        accountId = asset.issuer;

        const assetsUrl = `${HORIZON_URL}/assets?asset_code=${encodeURIComponent(asset.code)}&asset_issuer=${encodeURIComponent(asset.issuer)}&limit=1`;
        const assets = await fetchJson(assetsUrl, { signal });
        const record = assets?._embedded?.records?.[0];
        if (record?.amount != null) {
          const parsed = Number(record.amount);
          assetSupply = Number.isFinite(parsed) ? parsed : null;
        }
      }

      const accountUrl = `${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}`;
      const account = await fetchJson(accountUrl, { signal });

      const homeDomain = account?.home_domain || null;
      const { verified: domainVerified, homeDomain: normalizedDomain } = await verifyHomeDomain(homeDomain);

      const balances = Array.isArray(account?.balances) ? account.balances : [];
      const trustlinesCount = balances.filter((b) => b?.asset_type && b.asset_type !== "native").length;

      const flags = [];
      const accFlags = account?.flags || {};
      if (accFlags?.auth_required) flags.push("auth_required");
      if (accFlags?.auth_revocable) flags.push("auth_revocable");
      if (accFlags?.auth_immutable) flags.push("auth_immutable");
      if (isAsset && account?.clawback_enabled) flags.push("clawback_enabled");

      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      const txRecentUrl = `${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}/transactions?order=desc&limit=200`;
      const txRecent = await fetchJson(txRecentUrl, { signal });
      const recentRecords = Array.isArray(txRecent?._embedded?.records) ? txRecent._embedded.records : [];
      const txRecentCount = recentRecords.filter((t) => {
        const created = Date.parse(t?.created_at || "");
        return Number.isFinite(created) && created >= thirtyDaysAgo;
      }).length;

      const txOldestUrl = `${HORIZON_URL}/accounts/${encodeURIComponent(accountId)}/transactions?order=asc&limit=1`;
      const txOldest = await fetchJson(txOldestUrl, { signal });
      const oldest = txOldest?._embedded?.records?.[0];
      const oldestAt = oldest?.created_at ? Date.parse(oldest.created_at) : NaN;
      const ageDays = Number.isFinite(oldestAt) ? Math.max(0, Math.floor((now - oldestAt) / (24 * 60 * 60 * 1000))) : null;

      const { score, risk, color, reasons, insight } = computeRisk({
        ageDays,
        txRecentCount,
        trustlinesCount,
        domainVerified,
        flags,
        isAsset,
        assetSupply,
      });

      const breakdown = [
        {
          key: "age",
          title: "Account Age",
          value: ageDays == null ? "Unknown" : `${ageDays} days`,
          status: ageDays == null ? "Unknown" : ageDays < 14 ? "New" : ageDays < 90 ? "Growing" : "Established",
          tone: ageDays == null ? "slate" : ageDays < 14 ? "rose" : ageDays < 90 ? "amber" : "emerald",
        },
        {
          key: "tx",
          title: "Transactions (30d)",
          value: txRecentCount == null ? "Unknown" : txRecentCount.toLocaleString(),
          status: txRecentCount == null ? "Unknown" : txRecentCount < 5 ? "Very low" : txRecentCount < 25 ? "Low" : "Normal",
          tone: txRecentCount == null ? "slate" : txRecentCount < 5 ? "rose" : txRecentCount < 25 ? "amber" : "emerald",
        },
        {
          key: "trustlines",
          title: "Trustlines",
          value: trustlinesCount == null ? "Unknown" : String(trustlinesCount),
          status: trustlinesCount == null ? "Unknown" : trustlinesCount === 0 ? "None" : trustlinesCount < 10 ? "Typical" : "Broad",
          tone: trustlinesCount == null ? "slate" : trustlinesCount === 0 ? "amber" : "emerald",
        },
        {
          key: "domain",
          title: "Domain Status",
          value: normalizedDomain ? normalizedDomain : "—",
          status: domainVerified ? "Verified" : "Unverified",
          tone: domainVerified ? "emerald" : "rose",
        },
        {
          key: "supply",
          title: "Asset Supply",
          value: isAsset ? (assetSupply == null ? "Unknown" : assetSupply.toLocaleString()) : "—",
          status: !isAsset ? "N/A" : assetSupply == null ? "Unknown" : assetSupply > 600_000_000 ? "Elevated" : "Normal",
          tone: !isAsset ? "slate" : assetSupply == null ? "slate" : assetSupply > 600_000_000 ? "amber" : "emerald",
        },
        {
          key: "flags",
          title: "Flags",
          value: String(flags.length),
          status: flags.length ? "Present" : "None",
          tone: flags.length ? "amber" : "emerald",
        },
      ];

      return res.json({
        input: query,
        isAsset,
        address,
        score,
        risk,
        color,
        reasons,
        breakdown,
        insight,
        raw: { horizon: HORIZON_URL, accountId },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
    const message =
      status === 404
        ? "Not found on Stellar network (check address/issuer)."
        : err?.name === "AbortError"
          ? "Request timed out. Please try again."
          : "Scan failed. Please try again.";
    return res.status(status === 404 ? 404 : 500).json({ error: message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Sentio API server running on http://localhost:${PORT}`);
});
