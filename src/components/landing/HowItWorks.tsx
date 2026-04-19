import { motion, type Variants } from "framer-motion";
import {
  Search, ShieldCheck, Zap, Lock, Globe, BarChart3, GitBranch,
  AlertTriangle, Layers, Activity, TrendingUp, Database,
} from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: 0.06 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const STEPS = [
  {
    icon: Search,
    title: "Submit any Stellar identifier",
    body: "Paste a Stellar account address (G...), an asset code or issuer pair (USDC:GXXXXXX), or a Soroban contract ID (C...) directly into the Explorer. Sentio automatically detects the type and routes it to the correct analysis pipeline.",
  },
  {
    icon: Database,
    title: "Live data is fetched from Horizon",
    body: "Sentio queries Horizon — Stellar's canonical REST API — in parallel: account metadata, transaction history (last 200 transactions, 30-day window), open DEX offers, claimable balances, trustlines, operation breakdown, and counterparty profiles. All data is scoped to your selected network (Mainnet or Testnet), ensuring strict segregation with zero cross-network data leakage.",
  },
  {
    icon: BarChart3,
    title: "Multi-factor risk scoring runs server-side",
    body: "A weighted, multi-signal risk engine processes the raw data and computes a 0–100 risk score. Lower is safer. The score is then classified: Low Risk (0–29), Medium Risk (30–69), or High Risk (70–100). Every contributing factor is recorded and returned with its exact impact value.",
  },
  {
    icon: ShieldCheck,
    title: "Results are anchored on-chain",
    body: "After scoring, Sentio writes the risk verdict (score, confidence, category) back to a Soroban Smart Contract deployed on Stellar Testnet — the Risk Registry. This creates an auditable, immutable on-chain record independent of Sentio's servers. Any third-party can read this data directly from the ledger.",
  },
  {
    icon: Activity,
    title: "Live WebSocket stream keeps the score fresh",
    body: "For account scans, a persistent WebSocket connection subscribes to Horizon's real-time Server-Sent Event (SSE) stream. New transactions trigger an automatic re-score with the previous score as a baseline. The UI updates in real time — no manual refresh needed.",
  },
];

const ACCOUNT_SIGNALS = [
  {
    icon: TrendingUp,
    title: "Account Age",
    desc: "Accounts less than 7 days old carry a 15-point penalty; under 30 days, 8 points. Freshly created accounts are a primary vector for phishing and scam operations.",
  },
  {
    icon: Zap,
    title: "Transaction Velocity",
    desc: "The engine counts transactions in rolling 1-hour windows. More than 10 transactions in a single hour flags burst activity. High tx/hour rates contribute up to 20 points of risk.",
  },
  {
    icon: AlertTriangle,
    title: "Suspicious Patterns — Bot Detection",
    desc: "Repeated identical memos across multiple transactions is a strong bot-spam signal. Burst activity combined with repeated memos classifies the account as bot_spam (maximum penalty). Each flagged transaction contributes 2 points up to a 20-point cap.",
  },
  {
    icon: Globe,
    title: "Domain Verification via stellar.toml",
    desc: "Sentio fetches the account's home_domain, retrieves the /.well-known/stellar.toml file, and validates it for NETWORK_PASSPHRASE, SIGNING_KEY, or ACCOUNTS fields. Unverified domains add risk. Accounts explicitly listed in the TOML receive a trust bonus.",
  },
  {
    icon: GitBranch,
    title: "Counterparty Network Graph",
    desc: "Sentio maps the last 50 operations to identify unique counterparties — accounts this entity has sent to or received from. Up to 5 of those counterparties are cross-checked for their own stellar.toml verification. Unverified counterparties each contribute 4 risk points, capped at 20.",
  },
  {
    icon: Layers,
    title: "Trustline Quality & Lookalike Detection",
    desc: "Every non-native trustline is examined. Asset codes that closely imitate well-known tokens (e.g. 'USDCX' mimicking 'USDC') are flagged as lookalikes. The trustline quality score directly influences low-trust token exposure, which contributes up to 20 risk points.",
  },
  {
    icon: BarChart3,
    title: "Token Concentration",
    desc: "If one token makes up more than 70% of an account's non-native balance, a concentration flag is raised (10 points). Concentrated low-trust token stacks stack with low trustline quality for a compounding 8-point interaction penalty.",
  },
  {
    icon: Lock,
    title: "DEX Exposure, Claimable Balances & Soroban",
    desc: "Holding more than 10 open DEX offers raises an 8-point flag. Claiming 8 or more claimable balances suggests airdrop farming (10 points). More than 10 Soroban contract invocations in recent history signals heavy smart contract interaction (12 points).",
  },
];

const CONTRACT_SIGNALS = [
  {
    title: "Contract Age",
    desc: "Deployed today → −30. Under 7 days → −22. Under 30 days → −10. New contracts have no usage history to establish trust.",
  },
  {
    title: "Invocation Count",
    desc: "Zero invocations → −20 (entirely untested). Under 5 invocations → −12. Over 100 invocations → +8 bonus (well-scrutinized).",
  },
  {
    title: "Deployer Account Trust",
    desc: "If the deployer's account has no verified stellar.toml → −15. If the deployer account itself is less than 30 days old → −10. Scam contracts are frequently deployed from throwaway accounts.",
  },
  {
    title: "Caller Diversity",
    desc: "Zero unique callers → −8. Fewer than 3 unique callers → −12. More than 20 → +5 bonus. Organic usage has diverse participants; bots and tests do not.",
  },
  {
    title: "Usage Concentration",
    desc: "If a single account is responsible for more than 80% of all calls (and total calls > 3), −8 points. Concentrated usage is a bot or insider-activity pattern.",
  },
  {
    title: "Event Analysis",
    desc: "A burst of 10+ events in a 100-ledger window → −10 (exploit/spam signal). Admin or upgrade events → −15 (centralization risk). Unknown contract type → −5; classified type → +3.",
  },
];

function SignalCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-foreground/8 bg-sentio-surface/60 p-5 backdrop-blur-sm transition hover:border-foreground/14 hover:bg-sentio-surface/80">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/5">
        <Icon className="h-4.5 w-4.5 text-sentio-text-secondary" />
      </div>
      <p className="mb-1.5 text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-sentio-text-muted">{desc}</p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mt-28 scroll-mt-8">
      {/* ── Header ── */}
      <motion.div
        custom={0} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
        className="mx-auto max-w-2xl text-center"
      >
        <span className="inline-flex rounded-full border border-foreground/8 bg-sentio-surface/50 px-3 py-1.5 text-caption-upper">
          Methodology
        </span>
        <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          Transparent risk intelligence,{" "}
          <span className="bg-linear-to-r from-accent to-primary bg-clip-text text-transparent">
            from first principles
          </span>
        </h2>
        <p className="mt-4 text-base text-sentio-text-muted leading-relaxed">
          Sentio is a real-time risk intelligence platform for the Stellar network. It analyzes
          accounts, assets, and Soroban smart contracts using on-chain data — surfacing genuine
          threat signals before you interact with an unknown entity. No black boxes. Every
          factor is disclosed, weighted, and explained.
        </p>
      </motion.div>

      {/* ── Pipeline Steps ── */}
      <div className="mt-16 relative">
        <div className="absolute left-5 top-5 bottom-5 w-px bg-foreground/6 hidden sm:block" />
        <div className="space-y-6 sm:pl-14">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              custom={i + 1} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="relative flex gap-4"
            >
              <div className="absolute -left-14 hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-sentio-surface shadow-sentio-sm">
                <step.icon className="h-4 w-4 text-sentio-text-secondary" />
              </div>
              <div className="rounded-2xl border border-foreground/8 bg-sentio-surface/60 px-6 py-5 backdrop-blur-sm w-full">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-sentio-text-muted mb-1">
                  Step {i + 1}
                </p>
                <p className="font-semibold text-foreground">{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-sentio-text-muted">{step.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Score Methodology ── */}
      <motion.div
        custom={7} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
        className="mt-20"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-foreground/6" />
          <span className="text-xs font-semibold uppercase tracking-widest text-sentio-text-muted">Score methodology</span>
          <div className="h-px flex-1 bg-foreground/6" />
        </div>

        {/* Score bands */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { band: "0 – 29", label: "Low Risk", color: "emerald", desc: "Healthy signals. No major red flags detected. Proceed normally, but continue to monitor for changes." },
            { band: "30 – 69", label: "Medium Risk", color: "amber", desc: "Mixed signals. Verify the issuer's domain and stellar.toml before sending funds or opening trustlines." },
            { band: "70 – 100", label: "High Risk", color: "rose", desc: "Multiple elevated-risk indicators. Do not interact. Treat as untrusted until verified through independent means." },
          ].map(({ band, label, color, desc }) => (
            <div
              key={band}
              className={`rounded-2xl border p-5 ${
                color === "emerald" ? "border-emerald-500/20 bg-emerald-500/5"
                  : color === "amber" ? "border-amber-500/20 bg-amber-500/5"
                  : "border-rose-500/20 bg-rose-500/5"
              }`}
            >
              <p className={`text-2xl font-bold tabular-nums ${
                color === "emerald" ? "text-emerald-400"
                  : color === "amber" ? "text-amber-400"
                  : "text-rose-400"
              }`}>{band}</p>
              <p className="mt-1 font-semibold text-foreground">{label}</p>
              <p className="mt-2 text-xs leading-relaxed text-sentio-text-muted">{desc}</p>
            </div>
          ))}
        </div>

        {/* Time multiplier callout */}
        <div className="mt-6 rounded-2xl border border-foreground/8 bg-sentio-surface/60 px-6 py-5 text-sm leading-relaxed text-sentio-text-muted">
          <span className="font-semibold text-foreground">Temporal weighting. </span>
          Raw risk contributions are multiplied by a recency factor:{" "}
          <code className="rounded bg-foreground/6 px-1.5 py-0.5 font-mono text-xs">
            timeMultiplier = 0.6 + recentActivityScore × 0.4
          </code>
          , where <em>recentActivityScore</em> is derived from the number of transactions in the last 24 hours
          divided by a normalisation constant of 40. This means an account that is currently dormant
          receives a natural penalty reduction — past suspicious behaviour is discounted over time —
          while an account exhibiting high current activity has all signals amplified proportionally.
          The final score is clamped to the [0, 100] range.
        </div>
      </motion.div>

      {/* ── Account Signals Grid ── */}
      <motion.div
        custom={8} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
        className="mt-16"
      >
        <h3 className="text-lg font-semibold text-foreground">
          Account &amp; Asset Risk Signals
        </h3>
        <p className="mt-1.5 text-sm text-sentio-text-muted max-w-2xl">
          The following signals are evaluated for every account or asset scan. Each one contributes
          a defined number of risk points. Multiple signals can compound through interaction effects.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ACCOUNT_SIGNALS.map((s, i) => (
            <motion.div key={s.title} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <SignalCard icon={s.icon} title={s.title} desc={s.desc} />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Contract Signals ── */}
      <motion.div
        custom={9} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
        className="mt-16"
      >
        <h3 className="text-lg font-semibold text-foreground">
          Soroban Contract Risk Signals
        </h3>
        <p className="mt-1.5 text-sm text-sentio-text-muted max-w-2xl">
          Smart contracts are scored using a separate engine that begins at 100 and applies penalties
          or bonuses based on on-chain evidence gathered via Soroban RPC and the Stellar Expert API.
          Confidence is derived from how many data signals could be retrieved successfully.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTRACT_SIGNALS.map((s, i) => (
            <motion.div key={s.title} custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <div className="rounded-2xl border border-foreground/8 bg-sentio-surface/60 p-5 backdrop-blur-sm transition hover:border-foreground/14 hover:bg-sentio-surface/80">
                <p className="mb-1.5 text-sm font-semibold text-foreground">{s.title}</p>
                <p className="text-xs leading-relaxed text-sentio-text-muted">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── On-chain registry callout ── */}
      <motion.div
        custom={10} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
        className="mt-16 rounded-2xl border border-foreground/8 bg-sentio-surface/60 px-8 py-8 backdrop-blur-sm"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/5">
            <Lock className="h-5 w-5 text-sentio-text-secondary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-base">On-chain Risk Registry — immutable audit trail</p>
            <p className="mt-2 text-sm leading-relaxed text-sentio-text-muted max-w-3xl">
              Every risk verdict computed by Sentio is optionally written to a Soroban Smart Contract
              deployed on the Stellar Testnet — the <strong className="text-foreground">Risk Registry</strong>.
              This contract stores each address's risk score, confidence level, and category in persistent
              ledger storage, accessible by any on-chain or off-chain consumer. A ring-buffer of the last
              50 historical score entries is maintained per address, enabling trend analysis. Write access
              is controlled exclusively by the admin key, and all administrative transactions must be
              signed via Freighter wallet — preventing server-side key compromise from modifying registry
              data. Writes are rate-limited to once per 10 minutes per address to prevent XLM drain.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
