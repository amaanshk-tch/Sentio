import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ArrowLeft, Shield, AlertTriangle, Clock, Globe,
  Layers, Key, Coins, Users, TrendingUp, ExternalLink,
  ChevronRight, Copy, Check, RefreshCw, Info,
} from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/landing/BrandMark";
import { PageLayout } from "@/components/layout/PageLayout";
import {
  searchStellar, fetchAccountTransactions,
  type HorizonAccount, type HorizonAsset, type HorizonTransaction,
} from "@/lib/stellar";
import { scoreAccount, scoreAsset, type RiskReport, type RiskFactor } from "@/lib/riskEngine";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Copy button ─────────────────────────────────────────────────────────────

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

// ─── Risk Score Ring ──────────────────────────────────────────────────────────

function RiskRing({ score, color, label }: { score: number; color: string; label: string }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width={140} height={140} viewBox="0 0 140 140" className="-rotate-90">
        <circle cx={70} cy={70} r={r} fill="none" stroke="hsl(0 0% 100% / 0.05)" strokeWidth={10} />
        <motion.circle
          cx={70} cy={70} r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span
          className="font-mono text-3xl font-bold"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[0.6rem] font-semibold uppercase tracking-widest" style={{ color }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ─── Factor Row ───────────────────────────────────────────────────────────────

function FactorRow({ factor }: { factor: RiskFactor }) {
  const [open, setOpen] = useState(false);
  const severityColor: Record<string, string> = {
    low: "hsl(152 100% 45%)",
    medium: "hsl(43 96% 56%)",
    high: "hsl(25 95% 55%)",
    critical: "hsl(348 100% 58%)",
  };
  const color = severityColor[factor.severity];

  return (
    <div className="rounded-xl border border-foreground/6 bg-sentio-surface/40">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          />
          <span className="text-sm font-medium text-foreground">{factor.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs" style={{ color }}>
            {factor.value ?? `${factor.score}/100`}
          </span>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-foreground/8">
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${factor.score}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <ChevronRight
            className="h-3.5 w-3.5 text-sentio-text-muted transition-transform"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="border-t border-foreground/6 px-4 py-3 text-xs text-sentio-text-muted">
              {factor.description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`sentio-shimmer rounded-lg ${className}`} />;
}

// ─── Account Result Panel ─────────────────────────────────────────────────────

interface AccountPanelProps {
  account: HorizonAccount;
  risk: RiskReport;
  txns: HorizonTransaction[];
}

function AccountPanel({ account, risk, txns }: AccountPanelProps) {
  const xlmBal = account.balances.find(b => b.asset_type === "native");
  const tokens = account.balances.filter(b => b.asset_type !== "native" && b.asset_type !== "liquidity_pool_shares");

  return (
    <div className="space-y-4">
      {/* Identity header */}
      <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-sentio-text-muted">
                {shortAddress(account.account_id)}
              </span>
              <CopyButton text={account.account_id} />
              <a
                href={`https://stellar.expert/explorer/public/account/${account.account_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-sentio-text-muted hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            {account.home_domain && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-sentio-text-muted">
                <Globe className="h-3 w-3" />
                <span>{account.home_domain}</span>
              </div>
            )}
          </div>
          <div className="text-right text-xs text-sentio-text-muted">
            <div>Subentries: <span className="text-foreground">{account.subentry_count}</span></div>
            <div>Sponsoring: <span className="text-foreground">{account.num_sponsoring}</span></div>
            <div>Sponsored: <span className="text-foreground">{account.num_sponsored}</span></div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { icon: Coins, label: "XLM Balance", value: `${parseFloat(xlmBal?.balance ?? "0").toFixed(4)}` },
            { icon: Layers, label: "Tokens", value: `${tokens.length}` },
            { icon: Key, label: "Signers", value: `${account.signers.length}` },
            { icon: Clock, label: "Account Age", value: risk.accountAgeLabel ?? "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-foreground/6 bg-sentio-surface/50 p-3">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-sentio-text-muted" />
                <span className="text-[0.6rem] font-semibold uppercase tracking-widest text-sentio-text-muted">{label}</span>
              </div>
              <p className="mt-1.5 font-mono text-base font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Flags */}
      <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-sentio-text-muted">Account Flags</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(account.flags).map(([k, v]) => (
            <span
              key={k}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                v
                  ? "border border-sentio-danger/30 bg-sentio-danger/10 text-sentio-danger"
                  : "border border-foreground/6 bg-sentio-surface/50 text-sentio-text-muted"
              }`}
            >
              {k.replace(/_/g, " ")}
              {v ? " ✓" : " ✗"}
            </span>
          ))}
        </div>
      </div>

      {/* Balances */}
      {tokens.length > 0 && (
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-sentio-text-muted">
            Trustlines ({tokens.length})
          </h3>
          <div className="space-y-2">
            {tokens.slice(0, 12).map((b, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {(b.asset_code ?? "?").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{b.asset_code ?? "Unknown"}</p>
                    <p className="text-[0.6rem] text-sentio-text-muted">
                      {b.asset_issuer ? shortAddress(b.asset_issuer) : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">{parseFloat(b.balance).toFixed(4)}</p>
                  {b.is_authorized === false && (
                    <p className="text-[0.6rem] text-sentio-warning">Unauthorized</p>
                  )}
                </div>
              </div>
            ))}
            {tokens.length > 12 && (
              <p className="pt-1 text-center text-xs text-sentio-text-muted">
                +{tokens.length - 12} more trustlines
              </p>
            )}
          </div>
        </div>
      )}

      {/* Signers */}
      <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-sentio-text-muted">
          Signers ({account.signers.length})
        </h3>
        <div className="space-y-2">
          {account.signers.map((s, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-2.5">
              <div>
                <p className="font-mono text-xs text-foreground">{shortAddress(s.key)}</p>
                <p className="text-[0.6rem] text-sentio-text-muted">{s.type}</p>
              </div>
              <span className="rounded-lg border border-foreground/10 bg-sentio-surface px-2.5 py-1 text-xs font-medium">
                Weight: {s.weight}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-4 text-xs text-sentio-text-muted">
          <span>Low: {account.thresholds.low_threshold}</span>
          <span>Med: {account.thresholds.med_threshold}</span>
          <span>High: {account.thresholds.high_threshold}</span>
        </div>
      </div>

      {/* Recent Transactions */}
      {txns.length > 0 && (
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-sentio-text-muted">
            Recent Transactions
          </h3>
          <div className="space-y-2">
            {txns.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-2.5">
                <div>
                  <p className="font-mono text-xs text-foreground">{shortAddress(tx.id)}</p>
                  <p className="text-[0.6rem] text-sentio-text-muted">
                    {tx.operation_count} op{tx.operation_count !== 1 ? "s" : ""} · {timeAgo(tx.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[0.6rem] font-semibold ${tx.successful ? "text-sentio-success" : "text-sentio-danger"}`}>
                    {tx.successful ? "SUCCESS" : "FAILED"}
                  </span>
                  <a
                    href={`https://stellar.expert/explorer/public/tx/${tx.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sentio-text-muted hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Asset Result Panel ───────────────────────────────────────────────────────

function AssetPanel({ asset }: { asset: HorizonAsset; risk: RiskReport }) {
  const totalSupply = parseFloat(asset.balances?.authorized ?? "0")
    + parseFloat(asset.balances?.authorized_to_maintain_liabilities ?? "0");

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {asset.asset_code.slice(0, 2)}
              </div>
              <div>
                <h3 className="text-base font-semibold">{asset.asset_code}</h3>
                <p className="text-xs text-sentio-text-muted capitalize">{asset.asset_type.replace("_", " ")}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="font-mono text-xs text-sentio-text-muted">
                {shortAddress(asset.asset_issuer)}
              </span>
              <CopyButton text={asset.asset_issuer} />
              <a
                href={`https://stellar.expert/explorer/public/asset/${asset.asset_code}-${asset.asset_issuer}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-sentio-text-muted hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
          {asset._links?.toml?.href && (
            <a
              href={asset._links.toml.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-foreground/10 bg-sentio-surface px-3 py-1.5 text-xs font-medium text-sentio-text-muted hover:text-foreground"
            >
              <Globe className="h-3.5 w-3.5" />
              stellar.toml
            </a>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { icon: Users, label: "Authorized Holders", value: fmt(asset.accounts?.authorized ?? 0, 0) },
            { icon: TrendingUp, label: "Supply", value: fmt(totalSupply, 2) },
            { icon: Layers, label: "Liquidity Pools", value: `${asset.num_liquidity_pools ?? 0}` },
            { icon: Shield, label: "Claimable Bal.", value: `${asset.num_claimable_balances ?? 0}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-foreground/6 bg-sentio-surface/50 p-3">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-sentio-text-muted" />
                <span className="text-[0.6rem] font-semibold uppercase tracking-widest text-sentio-text-muted">{label}</span>
              </div>
              <p className="mt-1.5 font-mono text-base font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Flags */}
      <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-sentio-text-muted">Asset Flags</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(asset.flags).map(([k, v]) => (
            <span
              key={k}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                v
                  ? "border border-sentio-danger/30 bg-sentio-danger/10 text-sentio-danger"
                  : "border border-foreground/6 bg-sentio-surface/50 text-sentio-text-muted"
              }`}
            >
              {k.replace(/_/g, " ")} {v ? "✓" : "✗"}
            </span>
          ))}
        </div>
      </div>

      {/* Balance breakdown */}
      <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-sentio-text-muted">Balance Breakdown</h3>
        <div className="space-y-2">
          {[
            { label: "Authorized", value: asset.balances?.authorized ?? "0", holders: asset.accounts?.authorized ?? 0, ok: true },
            { label: "Auth. to Maintain Liabilities", value: asset.balances?.authorized_to_maintain_liabilities ?? "0", holders: asset.accounts?.authorized_to_maintain_liabilities ?? 0, ok: true },
            { label: "Unauthorized", value: asset.balances?.unauthorized ?? "0", holders: asset.accounts?.unauthorized ?? 0, ok: false },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-xl border border-foreground/5 bg-sentio-surface/30 px-4 py-2.5">
              <span className={`text-xs ${row.ok ? "text-sentio-text-secondary" : "text-sentio-warning"}`}>
                {row.label}
              </span>
              <div className="text-right">
                <p className="font-mono text-xs">{parseFloat(row.value).toFixed(4)}</p>
                <p className="text-[0.6rem] text-sentio-text-muted">{row.holders.toLocaleString()} accounts</p>
              </div>
            </div>
          ))}
        </div>
        {(asset.claimable_balances_amount && parseFloat(asset.claimable_balances_amount) > 0) && (
          <p className="mt-2 text-xs text-sentio-text-muted">
            Claimable: {parseFloat(asset.claimable_balances_amount).toFixed(4)} ({asset.num_claimable_balances} balances)
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Explorer Page ───────────────────────────────────────────────────────

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "done";
      mode: "account" | "asset";
      account?: HorizonAccount;
      asset?: HorizonAsset;
      risk: RiskReport;
      txns: HorizonTransaction[];
    };

export default function Explorer() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async (q: string = query) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setState({ status: "loading" });

    try {
      const { mode, account, asset } = await searchStellar(trimmed);
      let risk: RiskReport;
      let txns: HorizonTransaction[] = [];

      if (mode === "account" && account) {
        risk = scoreAccount(account);
        txns = await fetchAccountTransactions(account.account_id, 10);
      } else if (asset) {
        risk = scoreAsset(asset);
      } else {
        throw new Error("No results found.");
      }

      setState({ status: "done", mode, account, asset, risk, txns });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [query]);

  const reset = () => {
    setState({ status: "idle" });
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const isDone = state.status === "done";
  const isLoading = state.status === "loading";

  return (
    <PageLayout>
      {/* Navbar */}
      <header className="flex items-center justify-between gap-4 py-5">
        <BrandMark to="/" size="md" />
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-foreground/10 bg-sentio-surface/90 px-4 py-2.5 text-sm font-medium text-sentio-text-secondary shadow-sentio-sm backdrop-blur-md transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </header>

      {/* Page title */}
      <div className="mb-8 animate-fade-in-up">
        <span className="inline-flex rounded-full border border-foreground/8 bg-sentio-surface/50 px-3 py-1.5 text-caption-upper">
          Stellar Risk Explorer
        </span>
        <h1 className="text-display mt-4 max-w-[24ch]">
          Analyse any <strong>account</strong> or{" "}
          <span className="bg-linear-to-r from-accent to-primary bg-clip-text font-bold text-transparent">
            asset
          </span>
        </h1>
        <p className="text-body-lg mt-3 max-w-lg">
          Enter a Stellar account address (G...) or asset code (e.g. USDC or USDC:GXXX...) to get a live risk analysis.
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-8">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sentio-text-muted" />
            <input
              ref={inputRef}
              id="explorer-search"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="GXXXXXX... or USDC or USDC:GXXXX..."
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-3.5 pl-11 pr-4 font-mono text-sm text-foreground placeholder-sentio-text-muted backdrop-blur-md outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <button
            id="explorer-scan-btn"
            type="submit"
            disabled={!query.trim() || isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Scan
              </>
            )}
          </button>
        </form>

        {/* Example hints */}
        {state.status === "idle" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX",
              "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
              "XLM",
            ].map(ex => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); handleSearch(ex); }}
                className="rounded-lg border border-foreground/8 bg-sentio-surface/50 px-3 py-1.5 font-mono text-[0.7rem] text-sentio-text-muted transition hover:text-foreground"
              >
                {ex.length > 30 ? `${ex.slice(0, 18)}…` : ex}
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
            className="mb-6 flex items-start gap-3 rounded-2xl border border-sentio-danger/20 bg-sentio-danger/8 p-4"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sentio-danger" />
            <div>
              <p className="text-sm font-semibold text-sentio-danger">Scan failed</p>
              <p className="mt-0.5 text-xs text-sentio-danger/80">{state.message}</p>
            </div>
            <button
              onClick={reset}
              className="ml-auto text-xs text-sentio-text-muted hover:text-foreground"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-6 lg:grid-cols-[280px_1fr]"
          >
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
              <Skeleton className="h-[140px] w-[140px] rounded-full" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2 w-40" />
              <Skeleton className="h-2 w-36" />
              <div className="mt-2 w-full space-y-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full" />)}
            </div>
          </motion.div>
        )}

        {isDone && state.status === "done" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid gap-6 lg:grid-cols-[300px_1fr]"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6">
                <p className="mb-4 text-[0.6rem] font-semibold uppercase tracking-widest text-sentio-text-muted">
                  Risk Score
                </p>
                <div className="flex justify-center">
                  <RiskRing
                    score={state.risk.overallScore}
                    color={state.risk.color}
                    label={state.risk.label}
                  />
                </div>
                <p className="mt-4 text-center text-xs text-sentio-text-muted">
                  {state.risk.summary}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-foreground/6 bg-sentio-surface/40 px-4 py-2.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-xs text-sentio-text-muted capitalize">
                  {state.mode === "account" ? "Stellar Account" : "Stellar Asset"}
                </span>
                <button
                  onClick={reset}
                  className="ml-auto text-[0.65rem] text-sentio-text-muted hover:text-foreground"
                >
                  New scan
                </button>
              </div>

              <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-5">
                <div className="mb-3 flex items-center gap-1.5">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-widest text-sentio-text-muted">
                    Risk Factors
                  </p>
                  <Info className="h-3 w-3 text-sentio-text-muted" />
                </div>
                <div className="space-y-2">
                  {state.risk.factors.map(f => (
                    <FactorRow key={f.id} factor={f} />
                  ))}
                </div>
              </div>
            </div>

            <div>
              {state.mode === "account" && state.account && (
                <AccountPanel
                  account={state.account}
                  risk={state.risk}
                  txns={state.txns}
                />
              )}
              {state.mode === "asset" && state.asset && (
                <AssetPanel asset={state.asset} risk={state.risk} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}
