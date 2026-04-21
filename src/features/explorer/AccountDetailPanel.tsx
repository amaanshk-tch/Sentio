import { motion } from "framer-motion";
import {
  Globe, ExternalLink, Coins, Layers, Key, Users, TrendingUp,
  Shield, Clock, Activity, Info, AlertCircle, AlertTriangle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyButton } from "./Shared";
import { RiskScoreCard, EngineRiskCard } from "./ScanResultCard";
import { FlagBanner, OnchainFlagsCard, OnchainHistoryCard } from "./OnchainHistoryPanel";
import { shortAddress, isSafeHostname, fmt, isSafeUrl, timeAgo } from "./utils";
import type { ScanResult, OnchainRisk, OnchainFlag, ScanBreakdownItem } from "./utils";
import type { HorizonAccount, HorizonTransaction, HorizonOperation, HorizonAsset } from "@/lib/stellar";

const FLAG_DESCRIPTIONS: Record<string, string> = {
  auth_required:        "The issuer must approve any account that wants to hold this asset.",
  auth_revocable:       "The issuer can freeze an account's ability to transact with this asset.",
  auth_immutable:       "The above auth settings can never be changed — they are locked forever.",
  auth_clawback_enabled:"The issuer can claw back (forcibly retrieve) this asset from any holder.",
};

const toneStyles: Record<string, { border: string; bg: string; text: string; badge: string; dot: string }> = {
  emerald: {
    border: "border-emerald-500/25",
    bg:     "bg-emerald-500/8",
    text:   "text-emerald-400",
    badge:  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
    dot:    "bg-emerald-400",
  },
  rose: {
    border: "border-rose-500/25",
    bg:     "bg-rose-500/8",
    text:   "text-rose-400",
    badge:  "bg-rose-500/15 text-rose-400 border border-rose-500/25",
    dot:    "bg-rose-400",
  },
  amber: {
    border: "border-amber-500/25",
    bg:     "bg-amber-500/8",
    text:   "text-amber-400",
    badge:  "bg-amber-500/15 text-amber-400 border border-amber-500/25",
    dot:    "bg-amber-400",
  },
  slate: {
    border: "border-foreground/8",
    bg:     "bg-sentio-surface/40",
    text:   "text-sentio-text-muted",
    badge:  "bg-white/5 text-sentio-text-muted border border-foreground/8",
    dot:    "bg-sentio-text-muted",
  },
};

const breakdownIcons: Record<string, React.ElementType> = {
  age:        Clock,
  tx:         Activity,
  trustlines: Layers,
  domain:     Globe,
  supply:     TrendingUp,
  flags:      Shield,
};

export function ScanBreakdownCard({ breakdown }: { breakdown: ScanBreakdownItem[] }) {
  if (!breakdown || breakdown.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6"
    >
      <p className="mb-4 text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
        <Activity className="h-3.5 w-3.5" /> Signal Breakdown
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {breakdown.map((item) => {
          const tone   = toneStyles[item.tone ?? "slate"] ?? toneStyles.slate;
          const Icon   = breakdownIcons[item.key] ?? Info;
          return (
            <div
              key={item.key}
              className={`relative flex flex-col gap-2 rounded-xl border p-4 transition-colors ${tone.border} ${tone.bg}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${tone.dot}`} />
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${tone.text}`} />
                  <span className="text-[0.6rem] font-bold uppercase tracking-widest text-sentio-text-muted leading-none">
                    {item.title}
                  </span>
                </div>
              </div>
              <p className={`text-base font-bold leading-snug ${item.value === "—" ? "text-sentio-text-muted" : "text-foreground"}`}>
                {item.value}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${tone.badge}`}>
                  {item.status}
                </span>
                {item.flag && (
                  <span className="inline-flex rounded-md border border-sentio-warning/25 bg-sentio-warning/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-sentio-warning">
                    {item.flag.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function AccountPanel({ account, txns, ops, onchainHistory, onchainFlags, scanResult, isLive }: {
  account: HorizonAccount;
  txns: HorizonTransaction[];
  ops: HorizonOperation[];
  onchainHistory: OnchainRisk[];
  onchainFlags: OnchainFlag[];
  scanResult: ScanResult | null;
  isLive?: boolean;
}) {
  const xlmBal = account.balances.find(b => b.asset_type === "native");
  const tokens = account.balances.filter(b => b.asset_type !== "native" && b.asset_type !== "liquidity_pool_shares");

  return (
    <div className="space-y-4">
      <EngineRiskCard scan={scanResult} isLive={isLive} />
      {scanResult?.breakdown && <ScanBreakdownCard breakdown={scanResult.breakdown} />}
      <RiskScoreCard onchainHistory={onchainHistory} scanResult={scanResult} />
      <FlagBanner flags={onchainFlags} />

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
            {account.home_domain && isSafeHostname(account.home_domain) && (
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

      {(onchainFlags.length > 0 || onchainHistory.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {onchainFlags.length > 0 && <OnchainFlagsCard flags={onchainFlags} />}
          {onchainHistory.length > 0 && <OnchainHistoryCard history={onchainHistory} />}
        </div>
      )}

      {ops.length > 0 && (
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 max-h-[350px] flex flex-col">
          <h3 className="mb-4 text-sm flex items-center gap-2 font-semibold uppercase tracking-widest text-sentio-text-muted">
            <Activity className="h-4 w-4" /> Recent Operations ({ops.length})
          </h3>
          <div className="space-y-2.5 overflow-y-auto pr-1">
            {ops.map((op) => (
              <div key={op.id} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-3">
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {op.type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-sentio-text-muted mt-0.5">{timeAgo(op.created_at)}</p>
                </div>
                <a
                  href={`https://stellar.expert/explorer/public/op/${op.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 ml-2 p-2 rounded-lg bg-white/5 text-sentio-text-muted hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {scanResult && (scanResult.counterparties || scanResult.operationBreakdown) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {scanResult.counterparties && (
            <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
                <Users className="h-4 w-4" /> Counterparty Analysis
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Total", value: scanResult.counterparties.total },
                  { label: "Unique", value: scanResult.counterparties.unique },
                  { label: "Verified", value: scanResult.counterparties.knownVerified },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-foreground/6 bg-sentio-surface/50 p-3 text-center">
                    <p className="text-[0.6rem] font-bold uppercase tracking-widest text-sentio-text-muted">{label}</p>
                    <p className="text-xl font-bold text-foreground mt-1">{value}</p>
                  </div>
                ))}
              </div>
              {scanResult.counterparties.unique > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-sentio-text-muted">Verified ratio</span>
                    <span className="font-mono text-foreground">
                      {Math.round((scanResult.counterparties.knownVerified / scanResult.counterparties.unique) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-sentio-success"
                      style={{ width: `${Math.round((scanResult.counterparties.knownVerified / scanResult.counterparties.unique) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {scanResult.operationBreakdown && Object.keys(scanResult.operationBreakdown).length > 0 && (
            <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
                <Activity className="h-4 w-4" /> Operation Types
              </h3>
              <div className="space-y-2.5">
                {Object.entries(scanResult.operationBreakdown)
                  .sort(([,a], [,b]) => b - a)
                  .map(([type, count]) => {
                    const total = Object.values(scanResult.operationBreakdown!).reduce((s, v) => s + v, 0);
                    const pct = Math.round((count / total) * 100);
                    const isSoroban = type === "invoke_host_function";
                    return (
                      <div key={type}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className={`capitalize ${isSoroban ? "text-sentio-warning font-semibold" : "text-sentio-text-secondary"}`}>
                            {type.replace(/_/g, " ")}
                            {isSoroban && " \u26a1"}
                          </span>
                          <span className="font-mono text-foreground">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10">
                          <div
                            className={`h-1.5 rounded-full ${isSoroban ? "bg-sentio-warning" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {scanResult && (scanResult.dexExposure || scanResult.claimableBalances) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {scanResult.dexExposure && (
            <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> DEX Exposure
              </h3>
              <div className="flex items-end gap-3 mb-4">
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {scanResult.dexExposure.openOffers}
                </p>
                <p className="text-sm text-sentio-text-muted mb-1">open offers</p>
              </div>
              {scanResult.dexExposure.offerAssets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {scanResult.dexExposure.offerAssets.map((asset) => (
                    <span key={asset} className="inline-flex rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-primary">
                      {asset}
                    </span>
                  ))}
                </div>
              )}
              {scanResult.dexExposure.openOffers === 0 && (
                <p className="text-sm text-sentio-text-muted">No open DEX offers detected.</p>
              )}
            </div>
          )}

          {scanResult.claimableBalances && (
            <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sentio-text-muted flex items-center gap-2">
                <Activity className="h-4 w-4" /> Claimable Balances
              </h3>
              <div className="flex items-end gap-3">
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {scanResult.claimableBalances.count}
                </p>
                <p className="text-sm text-sentio-text-muted mb-1">pending claims</p>
              </div>
              {scanResult.claimableBalances.count >= 8 && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-sentio-warning/20 bg-sentio-warning/8 px-3 py-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sentio-warning" />
                  <p className="text-xs text-sentio-warning">High claimable balance count may indicate airdrop farming behavior.</p>
                </div>
              )}
              {scanResult.claimableBalances.count === 0 && (
                <p className="text-sm text-sentio-text-muted mt-2">No pending claimable balances.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AssetPanel({ asset, onchainHistory, onchainFlags, scanResult }: {
  asset: HorizonAsset;
  onchainHistory: OnchainRisk[];
  onchainFlags: OnchainFlag[];
  scanResult: ScanResult | null;
}) {
  const totalSupply = parseFloat(asset.balances?.authorized ?? "0")
    + parseFloat(asset.balances?.authorized_to_maintain_liabilities ?? "0");

  return (
    <div className="space-y-4">
      <EngineRiskCard scan={scanResult} />
      {scanResult?.breakdown && <ScanBreakdownCard breakdown={scanResult.breakdown} />}
      <RiskScoreCard onchainHistory={onchainHistory} scanResult={scanResult} />
      <FlagBanner flags={onchainFlags} />

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
          {asset._links?.toml?.href && isSafeUrl(asset._links.toml.href) && (
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
