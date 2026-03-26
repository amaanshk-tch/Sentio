import { motion, AnimatePresence } from "framer-motion";
import { Flag, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/cn";

const FLAG_DEFINITIONS = {
  newAccount:             { label: "New account",             desc: "Account created very recently — scams often appear fresh." },
  youngAccount:           { label: "Young account",           desc: "Account is less than 90 days old." },
  noDomain:               { label: "No verified domain",      desc: "No official stellar.toml found. Legitimate projects verify theirs." },
  lowActivity:            { label: "Low transaction activity", desc: "Very few transactions in the last 30 days." },
  highVelocity:           { label: "High transaction velocity", desc: "Unusually high number of transactions in the last 24 hours." },
  lookalikeAsset:         { label: "Lookalike asset code",    desc: "Asset code closely imitates a well-known token (e.g. USDCX vs USDC)." },
  poorTrustlineQuality:   { label: "Poor trustline quality",  desc: "Trustlines to potentially dubious or lookalike asset issuers." },
  clawbackEnabled:        { label: "Clawback enabled",        desc: "Issuer can take back tokens without your consent." },
  authRequired:           { label: "Auth required",           desc: "Trustlines require explicit issuer approval to open." },
  authRevocable:          { label: "Auth revocable",          desc: "Issuer can freeze tokens in your account." },
  highSupply:             { label: "Very high asset supply",  desc: "Asset has an unusually large circulating supply." },
  "suspiciousTxPattern:bot_spam": { label: "Bot / spam pattern", desc: "Repeated identical transactions suggest automated abuse." },
  "suspiciousTxPattern:burst":    { label: "Burst activity",      desc: "Flood of transactions in a short window — common in scam campaigns." },
};

function toFlagList(riskFactors) {
  if (!riskFactors) return [];
  const out = [];
  for (const [key, val] of Object.entries(riskFactors)) {
    if (!val) continue;
    const compositeKey = typeof val === "string" ? `${key}:${val}` : key;
    const def = FLAG_DEFINITIONS[compositeKey] ?? FLAG_DEFINITIONS[key];
    if (def) out.push(def);
  }
  return out;
}

export function RiskFlagsPanel({ riskFactors }) {
  const flags = toFlagList(riskFactors);
  const clean = flags.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "rounded-sentio-2xl border p-5 backdrop-blur-xl sm:p-6",
        clean
          ? "border-emerald-400/18 bg-emerald-500/5"
          : "border-rose-400/20 bg-rose-500/5"
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-sentio-text-muted">
        Risk Signals
      </p>

      <div className="mt-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {clean ? (
            <motion.div
              key="clean"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2.5 text-sm text-emerald-300"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="font-medium">No risk signals detected</span>
            </motion.div>
          ) : (
            flags.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                className="flex items-start gap-2.5"
              >
                <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden />
                <div>
                  <span className="text-xs font-semibold text-rose-200">{f.label}</span>
                  <span className="mx-1.5 text-sentio-text-subtle">—</span>
                  <span className="text-xs text-sentio-text-muted">{f.desc}</span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
