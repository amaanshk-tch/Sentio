import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ArrowLeft, Shield, AlertTriangle, Clock, Globe,
  Layers, Key, Coins, Users, TrendingUp, ExternalLink,
  Copy, Check, RefreshCw, AlertCircle, Info
} from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/landing/BrandMark";
import { PageLayout } from "@/components/layout/PageLayout";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  searchStellar, fetchAccountTransactions,
  type HorizonAccount, type HorizonAsset, type HorizonTransaction,
} from "@/lib/stellar";

// ─── Onchain Types ──────────────────────────────────────────────────────────

export interface OnchainRisk {
  score: number;
  confidence: number;
  category: string;
  last_updated: number;
}

export interface OnchainFlag {
  reporter: string;
  reason: string;
  severity: number;
  timestamp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 4) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(dec);
}

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Risk Score helpers ───────────────────────────────────────────────────────

function deriveRiskLabel(score: number): { label: string; color: string; bg: string; border: string } {
  if (score <= 20) return { label: "Safe",      color: "text-sentio-success",  bg: "bg-sentio-success/10",  border: "border-sentio-success/30" };
  if (score <= 45) return { label: "Low Risk",  color: "text-emerald-400",     bg: "bg-emerald-400/10",     border: "border-emerald-400/30" };
  if (score <= 65) return { label: "Moderate",  color: "text-sentio-warning",  bg: "bg-sentio-warning/10",  border: "border-sentio-warning/30" };
  if (score <= 80) return { label: "High Risk", color: "text-orange-400",      bg: "bg-orange-400/10",      border: "border-orange-400/30" };
  return               { label: "Critical",   color: "text-sentio-danger",   bg: "bg-sentio-danger/10",   border: "border-sentio-danger/30" };
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 inline-flex items-center rounded-md p-1 text-sentio-text-muted transition hover:text-foreground"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-sentio-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`sentio-shimmer rounded-lg ${className}`} />;
}

// ─── Risk Score Card ──────────────────────────────────────────────────────────

function RiskScoreCard({ onchainHistory }: { onchainHistory: OnchainRisk[] }) {
  if (onchainHistory.length === 0) return null;
  const latest = onchainHistory[0];
  const { label, color, bg, border } = deriveRiskLabel(latest.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-6 flex items-center justify-between gap-6 rounded-2xl border ${border} ${bg} p-5`}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-sentio-text-muted mb-1">Risk Assessment</p>
        <p className={`text-4xl font-bold tabular-nums ${color}`}>
          {latest.score}<span className="text-lg text-sentio-text-muted font-medium">/100</span>
        </p>
        <p className={`mt-1 text-sm font-semibold ${color}`}>{label}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-sentio-text-muted mb-1 uppercase tracking-wider font-bold">Category</p>
        <p className="text-base font-semibold text-white capitalize">{latest.category || "Unknown"}</p>
        <p className="text-xs text-sentio-text-muted mt-1">Confidence: {latest.confidence}%</p>
        <p className="text-xs text-sentio-text-muted mt-0.5">{timeAgo(new Date(latest.last_updated).toISOString())}</p>
      </div>
    </motion.div>
  );
}

// ─── 24h Flag Banner ──────────────────────────────────────────────────────────

function FlagBanner({ flags }: { flags: OnchainFlag[] }) {
  // eslint-disable-next-line react-hooks/purity
  const recentFlags = flags.filter(f => (Date.now() - f.timestamp) <= 24 * 60 * 60 * 1000);
  if (recentFlags.length === 0) return null;

  const maxSeverity = Math.max(...recentFlags.map(f => f.severity));
  const latestReason = recentFlags[0]?.reason;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-start gap-4 rounded-2xl border border-sentio-danger/30 bg-sentio-danger/10 p-5 shadow-[0_0_20px_rgba(225,29,72,0.1)] relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <AlertTriangle className="h-24 w-24 text-sentio-danger" />
      </div>
      <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-full bg-sentio-danger/20">
        <AlertCircle className="h-5 w-5 text-sentio-danger animate-pulse" />
      </div>
      <div className="z-10">
        <h3 className="text-sm font-bold text-sentio-danger uppercase tracking-wider">
          Flagged in the last 24 hours
        </h3>
        <p className="mt-1 text-sm text-sentio-text-secondary">
          This address has received <strong className="text-foreground">{recentFlags.length} active warning(s)</strong>.
          Latest reason: <span className="text-foreground font-medium">"{latestReason}"</span>
        </p>
        <div className="mt-3">
          <span className="inline-flex rounded-lg bg-sentio-danger/20 px-2.5 py-1 text-xs font-bold text-sentio-danger">
            Max Severity: {maxSeverity}/100
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Shared: Onchain Flags & History (used in both Account and Asset panels) ──

function OnchainFlagsCard({ flags }: { flags: OnchainFlag[] }) {
  return (
    <div className="rounded-2xl border border-sentio-warning/40 bg-sentio-warning/5 p-6 flex flex-col max-h-[350px]">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-warning flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> On-chain Incident Reports
      </h3>
      <div className="space-y-3 overflow-y-auto pr-1">
        {flags.map((flag, i) => (
          <div key={i} className="flex flex-col rounded-xl border border-sentio-warning/20 bg-background/60 p-4">
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm font-bold text-white">
                Reason: <span className="font-medium text-sentio-warning">"{flag.reason}"</span>
              </p>
              <span className="rounded bg-sentio-warning/20 px-2 py-1 text-[0.65rem] uppercase tracking-wider font-bold text-sentio-warning">
                Severity: {flag.severity}/100
              </span>
            </div>
            <div className="text-xs flex justify-between text-sentio-text-muted mt-2 border-t border-white/5 pt-2">
              <span className="font-mono">Reporter: {shortAddress(flag.reporter)}</span>
              <span>{timeAgo(new Date(flag.timestamp).toISOString())}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnchainHistoryCard({ history }: { history: OnchainRisk[] }) {
  return (
    <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 flex flex-col max-h-[350px]">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
        <Shield className="h-4 w-4" /> On-chain Risk Assessment History
      </h3>
      <div className="space-y-3 overflow-y-auto pr-1">
        {history.map((hist, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/40 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white capitalize">{hist.category}</p>
              <p className="text-xs text-sentio-text-muted mt-1">{timeAgo(new Date(hist.last_updated).toISOString())}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-white tabular-nums">
                {hist.score}<span className="text-sm text-sentio-text-muted font-medium">/100</span>
              </p>
              <p className="text-[0.65rem] uppercase tracking-wider font-bold text-primary mt-1">Conf: {hist.confidence}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Protocol Flag label descriptions ─────────────────────────────────────────

const FLAG_DESCRIPTIONS: Record<string, string> = {
  auth_required:        "The issuer must approve any account that wants to hold this asset.",
  auth_revocable:       "The issuer can freeze an account's ability to transact with this asset.",
  auth_immutable:       "The above auth settings can never be changed — they are locked forever.",
  auth_clawback_enabled:"The issuer can claw back (forcibly retrieve) this asset from any holder.",
};

// ─── Account Result Panel ──────────────────────────────────────────────────────

interface AccountPanelProps {
  account: HorizonAccount;
  txns: HorizonTransaction[];
  onchainHistory: OnchainRisk[];
  onchainFlags: OnchainFlag[];
}

function AccountPanel({ account, txns, onchainHistory, onchainFlags }: AccountPanelProps) {
  const xlmBal = account.balances.find(b => b.asset_type === "native");
  const tokens = account.balances.filter(b => b.asset_type !== "native" && b.asset_type !== "liquidity_pool_shares");

  return (
    <div className="space-y-4">
      <RiskScoreCard onchainHistory={onchainHistory} />
      <FlagBanner flags={onchainFlags} />

      {/* Identity header */}
      <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-primary/20 text-primary px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase">
              Stellar Account
            </span>
            <div className="flex items-center gap-2 mt-2">
              <h2 className="font-mono text-xl md:text-3xl font-semibold break-all text-white">
                {account.account_id}
              </h2>
              <div className="flex shrink-0">
                <CopyButton text={account.account_id} />
                <a
                  href={`https://stellar.expert/explorer/public/account/${account.account_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 flex items-center justify-center p-1.5 text-sentio-text-muted hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
            {account.home_domain && (
              <div className="mt-3 flex items-center gap-2 text-sm text-primary">
                <Globe className="h-4 w-4" />
                <a href={`https://${account.home_domain}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium">
                  {account.home_domain}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { icon: Coins,     label: "XLM Balance", value: `${parseFloat(xlmBal?.balance ?? "0").toFixed(4)}` },
            { icon: Layers,    label: "Tokens",       value: `${tokens.length}` },
            { icon: Key,       label: "Signers",      value: `${account.signers.length}` },
            { icon: Users,     label: "Subentries",   value: `${account.subentry_count}` },
            { icon: TrendingUp,label: "Sponsoring",   value: `${account.num_sponsoring}` },
            { icon: Users,     label: "Sponsored",    value: `${account.num_sponsored}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-foreground/6 bg-sentio-surface/50 p-4">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-sentio-text-muted" />
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted">{label}</span>
              </div>
              <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Protocol Flags */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 flex flex-col">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Shield className="h-4 w-4" /> Account Protocol Flags
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(account.flags).map(([k, v]) => (
              <Tooltip key={k}>
                <TooltipTrigger asChild>
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium cursor-help transition-colors ${
                    v
                      ? "border border-sentio-danger/30 bg-sentio-danger/10 text-sentio-danger"
                      : "border border-foreground/6 bg-sentio-surface/50 text-sentio-text-muted"
                  }`}>
                    {k.replace(/_/g, " ")}{v ? " ✓" : " ✗"}
                    <Info className="h-3 w-3 opacity-60" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs">
                  {FLAG_DESCRIPTIONS[k] ?? "No description available."}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          {Object.values(account.flags).every(v => !v) && (
            <p className="text-sm mt-2 text-sentio-text-muted">No elevated protocol flags enabled.</p>
          )}
        </div>

        {/* Signers */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 flex flex-col">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Key className="h-4 w-4" /> Signers & Thresholds
          </h3>
          <div className="flex gap-4 mb-4 pb-4 border-b border-white/5 text-sm">
            {(["low_threshold", "med_threshold", "high_threshold"] as const).map(k => (
              <div key={k} className="flex flex-col">
                <span className="text-sentio-text-muted text-xs uppercase">{k.replace("_threshold", "")}</span>
                <span className="font-mono font-bold mt-1 text-white">{account.thresholds[k]}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[200px] pr-1">
            {account.signers.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-3">
                <div className="overflow-hidden">
                  <p className="font-mono text-sm text-foreground truncate">{s.key}</p>
                  <p className="text-[0.7rem] uppercase tracking-wider font-semibold text-sentio-text-muted mt-1">{s.type}</p>
                </div>
                <span className="shrink-0 ml-3 rounded-lg border border-primary/20 bg-primary/10 text-primary px-3 py-1 text-sm font-bold">
                  W: {s.weight}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Trustlines — always rendered, shows empty state if none */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 max-h-[400px] flex flex-col">
          <h3 className="mb-4 text-sm flex items-center gap-2 font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Layers className="h-4 w-4" /> Trustlines ({tokens.length})
          </h3>
          {tokens.length === 0 ? (
            <p className="text-sm text-sentio-text-muted mt-2">No trustlines found on this account.</p>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1">
              {tokens.map((b, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {(b.asset_code ?? "?").slice(0, 2)}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-base font-bold flex items-center gap-2">
                        {b.asset_code ?? "Unknown"}
                        {b.is_authorized === false && (
                          <span className="text-[0.6rem] uppercase tracking-wider bg-sentio-warning/20 text-sentio-warning px-1.5 py-0.5 rounded">Unauthorized</span>
                        )}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-xs font-mono text-sentio-text-muted truncate max-w-[160px]" title={b.asset_issuer}>
                          {b.asset_issuer ? shortAddress(b.asset_issuer) : ""}
                        </p>
                        {b.asset_issuer && <CopyButton text={b.asset_issuer} />}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-base font-semibold">{parseFloat(b.balance).toFixed(4)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions — always rendered */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 max-h-[400px] flex flex-col">
          <h3 className="mb-4 text-sm flex items-center gap-2 font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Clock className="h-4 w-4" /> Recent Transactions
          </h3>
          {txns.length === 0 ? (
            <p className="text-sm text-sentio-text-muted mt-2">No recent transactions found.</p>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1">
              {txns.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-3">
                   <div className="overflow-hidden">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`h-2 w-2 rounded-full ${tx.successful ? "bg-sentio-success" : "bg-sentio-danger"}`} />
                      <p className="font-mono text-sm text-foreground truncate">{shortAddress(tx.id)}</p>
                      <CopyButton text={tx.id} />
                    </div>
                    <p className="text-xs text-sentio-text-muted font-medium">
                      {tx.operation_count} op{tx.operation_count !== 1 ? "s" : ""} · {timeAgo(tx.created_at)} · Fee: {tx.fee_charged} stroops
                    </p>
                  </div>
                  <a
                    href={`https://stellar.expert/explorer/public/tx/${tx.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 ml-2 p-2 rounded-lg bg-white/5 text-sentio-text-muted hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Onchain flags & history */}
      {(onchainFlags.length > 0 || onchainHistory.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {onchainFlags.length > 0 && <OnchainFlagsCard flags={onchainFlags} />}
          {onchainHistory.length > 0 && <OnchainHistoryCard history={onchainHistory} />}
        </div>
      )}
    </div>
  );
}

// ─── Asset Result Panel ────────────────────────────────────────────────────────

interface AssetPanelProps {
  asset: HorizonAsset;
  onchainHistory: OnchainRisk[];
  onchainFlags: OnchainFlag[];
}

function AssetPanel({ asset, onchainHistory, onchainFlags }: AssetPanelProps) {
  const totalSupply = parseFloat(asset.balances?.authorized ?? "0")
    + parseFloat(asset.balances?.authorized_to_maintain_liabilities ?? "0");

  return (
    <div className="space-y-4">
      <RiskScoreCard onchainHistory={onchainHistory} />
      <FlagBanner flags={onchainFlags} />

      {/* Identity */}
      <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-lg font-bold text-primary uppercase">
                {asset.asset_code.slice(0, 2)}
              </div>
              <div>
                <h2 className="text-3xl font-bold flex items-center gap-3">
                  {asset.asset_code}
                  <span className="inline-flex rounded-full bg-white/10 text-sentio-text-secondary px-2.5 py-1 text-xs font-semibold tracking-wide uppercase self-center translate-y-0.5">
                    {asset.asset_type.replace("_", " ")}
                  </span>
                </h2>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 bg-black/40 rounded-xl p-4 border border-white/5 w-full">
              <span className="text-xs font-semibold uppercase tracking-widest text-sentio-text-muted whitespace-nowrap">Issuer:</span>
              <div className="flex flex-1 items-center gap-2 overflow-hidden w-full">
                <span className="font-mono text-sm text-white truncate flex-1" title={asset.asset_issuer}>
                  {asset.asset_issuer}
                </span>
                <div className="flex shrink-0">
                  <CopyButton text={asset.asset_issuer} />
                  <a
                    href={`https://stellar.expert/explorer/public/asset/${asset.asset_code}-${asset.asset_issuer}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 flex p-1.5 rounded-md text-sentio-text-muted hover:text-white transition-colors hover:bg-white/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
          {asset._links?.toml?.href && (
            <a
              href={asset._links.toml.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
            >
              <Globe className="h-4 w-4" />
              View stellar.toml
            </a>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Users,   label: "Authorized Holders", value: fmt(asset.accounts?.authorized ?? 0, 0) },
            { icon: TrendingUp, label: "Total Supply",    value: fmt(totalSupply, 2) },
            { icon: Layers,  label: "Liquidity Pools",    value: `${asset.num_liquidity_pools ?? 0}` },
            { icon: Shield,  label: "Claimable Balances", value: `${asset.num_claimable_balances ?? 0}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-foreground/6 bg-sentio-surface/50 p-4">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-sentio-text-muted" />
                <span className="text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted">{label}</span>
              </div>
              <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Protocol Flags */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 flex flex-col">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Shield className="h-4 w-4" /> Asset Protocol Flags
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(asset.flags).map(([k, v]) => (
              <Tooltip key={k}>
                <TooltipTrigger asChild>
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium cursor-help transition-colors ${
                    v
                      ? "border border-sentio-danger/30 bg-sentio-danger/10 text-sentio-danger"
                      : "border border-foreground/6 bg-sentio-surface/50 text-sentio-text-muted"
                  }`}>
                    {k.replace(/_/g, " ")} {v ? "✓" : "✗"}
                    <Info className="h-3 w-3 opacity-60" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs">
                  {FLAG_DESCRIPTIONS[k] ?? "No description available."}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Balance breakdown */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 flex flex-col">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Coins className="h-4 w-4" /> Balance Exposure
          </h3>
          <div className="space-y-3">
            {[
              { label: "Authorized",               value: asset.balances?.authorized ?? "0",                            holders: asset.accounts?.authorized ?? 0,                            ok: true },
              { label: "Auth. to Maintain Liab.",  value: asset.balances?.authorized_to_maintain_liabilities ?? "0",   holders: asset.accounts?.authorized_to_maintain_liabilities ?? 0,   ok: true },
              { label: "Unauthorized",             value: asset.balances?.unauthorized ?? "0",                         holders: asset.accounts?.unauthorized ?? 0,                         ok: false },
            ].map((row) => (
              <div key={row.label} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${row.ok ? "border-foreground/5 bg-sentio-surface/30" : "border-sentio-danger/20 bg-sentio-danger/5"}`}>
                <div className="font-medium text-sm">
                  <span className={row.ok ? "text-sentio-text-secondary" : "text-sentio-danger flex items-center gap-1"}>
                    {!row.ok && <AlertCircle className="h-3.5 w-3.5" />} {row.label}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-mono text-base font-semibold">{parseFloat(row.value).toFixed(2)}</p>
                  <p className="text-[0.65rem] text-sentio-text-muted uppercase tracking-wider font-bold mt-0.5">{row.holders.toLocaleString()} accounts</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(onchainFlags.length > 0 || onchainHistory.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {onchainFlags.length > 0 && <OnchainFlagsCard flags={onchainFlags} />}
          {onchainHistory.length > 0 && <OnchainHistoryCard history={onchainHistory} />}
        </div>
      )}
    </div>
  );
}

// ─── Main Explorer Page ────────────────────────────────────────────────────────

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "done";
      mode: "account" | "asset";
      account?: HorizonAccount;
      asset?: HorizonAsset;
      txns: HorizonTransaction[];
      onchainHistory: OnchainRisk[];
      onchainFlags: OnchainFlag[];
    };

export default function Explorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    // Sync query to URL so results are shareable/bookmarkable
    setSearchParams({ q: trimmed }, { replace: true });
    setState({ status: "loading" });

    try {
      const { mode, account, asset } = await searchStellar(trimmed);
      let txns: HorizonTransaction[] = [];

      if (mode === "account" && account) {
        txns = await fetchAccountTransactions(account.account_id, 10);
      } else if (!asset) {
        throw new Error("No results found.");
      }

      const addressToFetch = mode === "account" && account
        ? account.account_id
        : asset ? `${asset.asset_code}:${asset.asset_issuer}` : "";

      let onchainHistory: OnchainRisk[] = [];
      let onchainFlags: OnchainFlag[] = [];

      if (addressToFetch) {
        try {
          const [histRes, flagsRes] = await Promise.all([
            fetch(`/api/registry/history/${addressToFetch}`).then(r => r.ok ? r.json() : { history: [] }),
            fetch(`/api/registry/flags/${addressToFetch}`).then(r => r.ok ? r.json() : { flags: [] }),
          ]);
          onchainHistory = histRes.history || [];
          onchainFlags = flagsRes.flags || [];
        } catch {
          console.warn("Failed to fetch onchain data");
        }
      }

      setState({ status: "done", mode, account, asset, txns, onchainHistory, onchainFlags });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [setSearchParams]);

  // Auto-search on mount if URL has a query param
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) handleSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setState({ status: "idle" });
    setQuery("");
    setSearchParams({}, { replace: true });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const isDone = state.status === "done";
  const isLoading = state.status === "loading";

  return (
    <PageLayout>
      <header className="flex items-center justify-between gap-4 py-5 mb-4">
        <BrandMark to="/" size="lg" />
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-foreground/10 bg-sentio-surface/90 px-4 py-2.5 text-sm font-medium text-sentio-text-secondary shadow-sentio-sm backdrop-blur-md transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </header>

      <div className="mb-8 animate-fade-in-up md:text-center md:flex md:flex-col md:items-center">
        <span className="inline-flex rounded-full border border-foreground/8 bg-sentio-surface/50 px-3 py-1.5 text-caption-upper">
          Stellar Explorer
        </span>
        <h1 className="text-display mt-4 max-w-[24ch]">
          Search any <strong>account</strong> or{" "}
          <span className="bg-linear-to-r from-accent to-primary bg-clip-text font-bold text-transparent">
            asset
          </span>
        </h1>
        <p className="text-body-lg mt-4 max-w-lg">
          Enter a Stellar account address or asset code to retrieve on-chain details and risk assessment.
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-10 max-w-2xl mx-auto">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
          className="flex flex-col sm:flex-row gap-2 shadow-sentio-lg rounded-2xl"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sentio-text-muted" />
            <input
              ref={inputRef}
              id="explorer-search"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="GXXXXXX... or USDC or USDC:GXXXX..."
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-2xl border border-foreground/10 bg-sentio-surface/80 py-4 pl-12 pr-4 font-mono text-sm sm:text-base text-foreground placeholder-sentio-text-muted backdrop-blur-md outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/20 shadow-inner"
            />
          </div>
          <button
            id="explorer-scan-btn"
            type="submit"
            disabled={!query.trim() || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 text-sm sm:text-base font-bold text-primary-foreground transition hover:opacity-90 hover:shadow-sentio-glow disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <><RefreshCw className="h-5 w-5 animate-spin" />Searching…</>
            ) : (
              <><Search className="h-5 w-5" />Search</>
            )}
          </button>
        </form>

        {/* Example hints */}
        {state.status === "idle" && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[
              { label: "Example account", value: "GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX" },
              { label: "USDC asset",      value: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
              { label: "XLM (native)",   value: "XLM" },
            ].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => { setQuery(value); handleSearch(value); }}
                className="rounded-xl border border-foreground/8 bg-sentio-surface/50 px-3 py-2 text-xs text-sentio-text-muted transition hover:text-foreground hover:bg-white/5 active:scale-95"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results & Errors */}
      <AnimatePresence mode="wait">
        {state.status === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-8 mx-auto max-w-2xl flex items-start gap-4 rounded-2xl border border-sentio-danger/30 bg-sentio-danger/10 p-5 shadow-sentio-md"
          >
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-sentio-danger" />
            <div className="flex-1">
              <p className="text-base font-bold text-sentio-danger">Search failed</p>
              <p className="mt-1 text-sm text-sentio-danger/90">{state.message}</p>
            </div>
            <button
              onClick={reset}
              className="text-xs font-semibold uppercase tracking-wider text-sentio-text-muted hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-5xl mx-auto mt-8 w-full"
          >
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-64 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
              </div>
            </div>
          </motion.div>
        )}

        {isDone && state.status === "done" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-5xl mx-auto mt-8 w-full"
          >
            {state.mode === "account" && state.account && (
              <AccountPanel
                account={state.account}
                txns={state.txns}
                onchainHistory={state.onchainHistory}
                onchainFlags={state.onchainFlags}
              />
            )}
            {state.mode === "asset" && state.asset && (
              <AssetPanel
                asset={state.asset}
                onchainHistory={state.onchainHistory}
                onchainFlags={state.onchainFlags}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}
