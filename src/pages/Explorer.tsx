import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";

import { BrandMark } from "@/components/landing/BrandMark";
import { PageLayout } from "@/components/layout/PageLayout";
import { WalletConnect } from "@/components/ui/WalletConnect";
import { NetworkToggle } from "@/components/ui/NetworkToggle";

import { useWallet } from "@/contexts/WalletContext";
import { useNetwork } from "@/contexts/NetworkContext";

import { useLiveStream } from "@/features/explorer/useLiveStream";
import { useSearchHistory } from "@/features/explorer/useSearchHistory";
import { useExplorerSearch } from "@/features/explorer/useExplorerSearch";
import type { ScanResult } from "@/features/explorer/utils";

import { SearchBar } from "@/features/explorer/SearchBar";
import { AccountPanel, AssetPanel } from "@/features/explorer/AccountDetailPanel";
import { ContractResultCard } from "@/features/explorer/ContractResultCard";
import { Skeleton, RateLimitCountdown } from "@/features/explorer/Shared";

export default function Explorer() {
  const { network } = useNetwork();
  const freighter = useWallet();
  const inputRef = useRef<HTMLInputElement>(null);
  const [userCount, setUserCount] = useState<number | null>(null);

  const { searchHistory, setSearchHistory, logSearch, registerWallet } = useSearchHistory(
    freighter.isConnected,
    freighter.publicKey
  );
  
  const {
    query,
    setQuery,
    state,
    setState,
    scanStep,
    handleSearch,
    reset
  } = useExplorerSearch(
    network,
    freighter.isConnected,
    freighter.publicKey,
    logSearch,
    setSearchHistory
  );

  const liveAccountId = state.status === "done" && state.mode === "account" && state.account
    ? state.account.account_id
    : null;

  const { status: streamStatus, lastTxId } = useLiveStream(
    liveAccountId,
    network,
    useCallback((patch: Partial<ScanResult>) => {
      setState((prev) => {
        if (prev.status !== "done") return prev;
        return { ...prev, scanResult: prev.scanResult ? { ...prev.scanResult, ...patch } : prev.scanResult };
      });
    }, [setState]),
    useCallback((total: number) => setUserCount(total), []),
  );

  const isDone    = state.status === "done";
  const isLoading = state.status === "loading";

  return (
    <PageLayout>
      <header className="flex items-center justify-between gap-4 py-5 mb-4">
        <BrandMark to="/" size="lg" />
        <div className="flex items-center gap-3">
          {userCount !== null && (
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-3 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-xs font-bold tabular-nums text-primary">{userCount.toLocaleString()}</span>
              <span className="text-[0.6rem] font-semibold uppercase tracking-widest text-sentio-text-muted">users</span>
            </div>
          )}
          <WalletConnect
            onConnected={(key) => {
              registerWallet(key, network);
            }}
          />
          <NetworkToggle />
          {state.status !== "idle" ? (
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl border border-foreground/10 bg-sentio-surface/90 px-4 py-2.5 text-sm font-medium text-sentio-text-secondary shadow-sentio-sm backdrop-blur-md transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-foreground/10 bg-sentio-surface/90 px-4 py-2.5 text-sm font-medium text-sentio-text-secondary shadow-sentio-sm backdrop-blur-md transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          )}
        </div>
      </header>

      <div className="mb-8 animate-fade-in-up md:text-center md:flex md:flex-col md:items-center">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex rounded-full border border-foreground/8 bg-sentio-surface/50 px-3 py-1.5 text-caption-upper">
            Stellar Explorer
          </span>
          <span className={[
            "inline-flex items-center gap-1.5 rounded-md border border-foreground/10 bg-sentio-surface/80 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
            network === "mainnet"
              ? "text-emerald-500"
              : "text-amber-500",
          ].join(" ")}>
            <span className={`h-1.5 w-1.5 rounded-full ${network === "mainnet" ? "bg-emerald-500" : "bg-amber-500"}`} />
            {network === "mainnet" ? "Mainnet" : "Testnet"}
          </span>
        </div>
        <h1 className="text-display mt-4 max-w-[24ch]">
          Scan any <strong>account</strong>,{" "}
          <span className="bg-linear-to-r from-accent to-primary bg-clip-text font-bold text-transparent">
            asset
          </span>
          {" "}or contract
        </h1>
        <p className="text-body-lg mt-4 max-w-lg">
          Enter a Stellar account address, asset code, or Soroban contract ID to retrieve on-chain details and risk assessment.
        </p>
      </div>

      <SearchBar
        query={query}
        setQuery={setQuery}
        handleSearch={handleSearch}
        state={state}
        network={network}
        searchHistory={searchHistory}
        setSearchHistory={setSearchHistory}
        isConnected={freighter.isConnected}
        inputRef={inputRef}
      />

      <AnimatePresence mode="wait">
        {state.status === "error" && (
          state.isRateLimit ? (
            <RateLimitCountdown 
              key="ratelimit"
              retryAfter={state.retryAfter ?? 60} 
              onDismiss={reset} 
            />
          ) : (
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
          )
        )}

        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-5xl mx-auto mt-8 w-full"
          >
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-sentio-text-muted animate-pulse">
                {scanStep ?? "Starting scan..."}
              </p>
            </div>
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/8 bg-sentio-surface/60 px-5 py-3">
              <div className="flex flex-wrap items-center gap-4 text-xs text-sentio-text-muted">
                <span className={[
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-bold uppercase tracking-widest",
                  state.network === "mainnet"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-400",
                ].join(" ")}>
                  {state.network}
                </span>
                {state.ledger && (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-3 w-3" />
                    Ledger <span className="font-mono text-foreground font-bold">{state.ledger.sequence}</span>
                  </span>
                )}
                {liveAccountId && (
                  <div className="flex items-center gap-2 border-l border-white/5 pl-4">
                    {streamStatus === "live" ? (
                      <>
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sentio-success opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-sentio-success" />
                        </span>
                        <span className="font-semibold text-sentio-success uppercase tracking-wider">Live Monitoring</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3.5 w-3.5 text-sentio-text-muted" />
                        <span className="font-semibold text-sentio-text-muted uppercase tracking-wider">Stream Offline</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <AnimatePresence>
                {lastTxId && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-2 rounded-lg bg-sentio-success/15 px-2 py-1 text-[0.65rem] font-bold text-sentio-success"
                  >
                    <Wifi className="h-3 w-3" />
                    NEW ACTIVITY: {lastTxId.slice(0, 8)}…
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {state.mode === "account" && state.account && (
              <AccountPanel
                account={state.account}
                txns={state.txns}
                ops={state.ops}
                onchainHistory={state.onchainHistory}
                onchainFlags={state.onchainFlags}
                scanResult={state.scanResult}
                isLive={streamStatus === "live"}
              />
            )}
            
            {state.mode === "asset" && state.asset && (
              <AssetPanel
                asset={state.asset}
                onchainHistory={state.onchainHistory}
                onchainFlags={state.onchainFlags}
                scanResult={state.scanResult}
              />
            )}

            {state.mode === "contract" && state.contractResult && (
              <ContractResultCard result={state.contractResult} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}