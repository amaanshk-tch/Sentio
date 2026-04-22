import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { searchStellar, fetchAccountTransactions, fetchAccountOperations, fetchLatestLedger } from "@/lib/stellar";
import type { HorizonAccount, HorizonAsset, HorizonTransaction, HorizonOperation, LedgerStats } from "@/lib/stellar";
import type { ContractScanResult, ScanResult, OnchainRisk, OnchainFlag } from "./utils";
import type { SearchHistoryItem } from "./useSearchHistory";

export type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; isRateLimit?: boolean; retryAfter?: number }
  | {
      status: "done";
      mode: "account" | "asset" | "contract";
      network: "mainnet" | "testnet";
      account?: HorizonAccount;
      asset?: HorizonAsset;
      contractResult?: ContractScanResult;
      txns: HorizonTransaction[];
      ops: HorizonOperation[];
      onchainHistory: OnchainRisk[];
      onchainFlags: OnchainFlag[];
      scanResult: ScanResult | null;
      ledger: LedgerStats | null;
    };

export function useExplorerSearch(
  network: "mainnet" | "testnet",
  isConnected: boolean,
  publicKey: string | null,
  logSearch: (walletKey: string, scannedAddress: string, network: string) => Promise<void>,
  setSearchHistory: React.Dispatch<React.SetStateAction<SearchHistoryItem[]>>
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [scanStep, setScanStep] = useState<string | null>(null);
  const lastQueryRef = useRef<string | null>(null);

  const handleSearch = useCallback(async (q: string, opts?: { network?: string }) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    lastQueryRef.current = trimmed;

    setSearchParams({ q: trimmed }, { replace: true });
    setState({ status: "loading" });

    if (trimmed.toUpperCase() === "XLM") {
      setState({
        status: "error",
        message: "XLM is Stellar's native currency and doesn't have an issuer address. Try searching a specific asset like USDC:GXXXXXXX or an account address.",
      });
      return;
    }

    const activeNetwork = (opts?.network ?? network) as "mainnet" | "testnet";
    const isContract = /^C[A-Z2-7]{55}$/.test(trimmed);

    try {
      setScanStep("Fetching account data...");
      if (isContract) {
        const res = await fetch("/api/scan/contract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId: trimmed, network: activeNetwork }),
        });
        if (res.status === 429) {
          const ra = parseInt(res.headers.get("Retry-After") || "60", 10);
          setState({ status: "error", message: "Too many requests", isRateLimit: true, retryAfter: ra });
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Contract scan failed." }));
          throw new Error(err.error ?? "Contract scan failed.");
        }
        const contractResult: ContractScanResult = await res.json();
        setScanStep(null);
        setState({
          status: "done", mode: "contract", network: activeNetwork,
          contractResult,
          txns: [], ops: [], onchainHistory: [], onchainFlags: [], scanResult: null, ledger: null,
        });
        return;
      }

      const { mode, account, asset } = await searchStellar(trimmed, activeNetwork);
      let txns: HorizonTransaction[] = [];
      let ops: HorizonOperation[] = [];

      if (mode === "account" && account) {
        [txns, ops] = await Promise.all([
          fetchAccountTransactions(account.account_id, 10, activeNetwork),
          fetchAccountOperations(account.account_id, 10, activeNetwork),
        ]);
      } else if (!asset) {
        throw new Error("No results found.");
      }

      const addressToFetch = mode === "account" && account
        ? account.account_id
        : asset ? `${asset.asset_code}:${asset.asset_issuer}` : "";

      let onchainHistory: OnchainRisk[] = [];
      let onchainFlags: OnchainFlag[] = [];
      let scanResult: ScanResult | null = null;
      let ledger: LedgerStats | null = null;

      if (addressToFetch) {
        try {
          setScanStep("Analyzing transactions...");
          const scanReq = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: trimmed, network: activeNetwork }),
          });

          if (scanReq.status === 429) {
            const ra = parseInt(scanReq.headers.get("Retry-After") || "60", 10);
            setState({ status: "error", message: "Too many requests", isRateLimit: true, retryAfter: ra });
            return;
          }

          const scanResPromise = scanReq.ok ? scanReq.json() : null;

          setScanStep("Checking on-chain registry...");
          const [histRes, flagsRes, scanRes, ledgerRes] = await Promise.all([
            fetch(`/api/registry/history/${addressToFetch}`).then(r => r.ok ? r.json() : { history: [] }),
            fetch(`/api/registry/flags/${addressToFetch}`).then(r => r.ok ? r.json() : { flags: [] }),
            scanResPromise,
            fetchLatestLedger(activeNetwork),
          ]);
          onchainHistory = histRes.history || [];
          onchainFlags   = flagsRes.flags  || [];
          scanResult     = scanRes;
          ledger         = ledgerRes;
        } catch {
          console.warn("Failed to fetch onchain or scan data");
        }
      }

      setScanStep(null);
      setState({ status: "done", mode, network: activeNetwork, account, asset, txns, ops, onchainHistory, onchainFlags, scanResult, ledger });

      if (isConnected && publicKey) {
        logSearch(publicKey, trimmed, activeNetwork);
        setSearchHistory(prev => [{
          scannedAddress: trimmed,
          network: activeNetwork,
          searchedAt: new Date().toISOString()
        }, ...prev].slice(0, 50));
      }
    } catch (err) {
      setScanStep(null);
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [setSearchParams, network, isConnected, publicKey, logSearch, setSearchHistory]);

  const handleSearchRef = useRef(handleSearch);
  useEffect(() => {
    handleSearchRef.current = handleSearch;
  }, [handleSearch]);

  const searchedNetworkRef = useRef(network);
  useEffect(() => {
    const q = lastQueryRef.current;
    if (q && state.status === "done" && searchedNetworkRef.current !== network) {
      searchedNetworkRef.current = network;
      setState({ status: "loading" });
      handleSearchRef.current(q, { network });
    }
  }, [network, state.status]);

  const reset = () => {
    setState({ status: "idle" });
    setQuery("");
    lastQueryRef.current = null;
    setSearchParams({}, { replace: true });
  };

  return { query, setQuery, state, setState, scanStep, handleSearch, reset };
}
