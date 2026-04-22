import { useState, useEffect, useCallback } from "react";

export interface SearchHistoryItem {
  scannedAddress: string;
  network: string;
  searchedAt: string;
}

export function useSearchHistory(isConnected: boolean, publicKey: string | null) {
  const [rawHistory, setRawHistory] = useState<SearchHistoryItem[]>([]);

  useEffect(() => {
    if (isConnected && publicKey) {
      fetch(`/api/users/history/${publicKey}`)
        .then(r => r.ok ? r.json() : { history: [] })
        .then(data => setRawHistory(data.history || []))
        .catch(() => {});
    }
  }, [isConnected, publicKey]);

  const searchHistory = (isConnected && publicKey) ? rawHistory : [];

  const logSearch = useCallback(async (walletKey: string, scannedAddress: string, network: string) => {
    try {
      await fetch("/api/users/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: walletKey, scannedAddress, network }),
      });
    } catch {
      // Non-critical: failure to log search history doesn't break the scan
    }
  }, []);

  const registerWallet = useCallback(async (walletKey: string, network: string) => {
    try {
      await fetch("/api/users/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: walletKey, network }),
      });
    } catch {
      // Non-critical: failure to register wallet doesn't break the experience
    }
  }, []);

  return { searchHistory, setSearchHistory: setRawHistory, logSearch, registerWallet };
}
