/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type NetworkType = "mainnet" | "testnet";

export const NETWORK_LABELS: Record<NetworkType, string> = {
  mainnet: "Mainnet",
  testnet: "Testnet",
};

export const NETWORK_PASSPHRASES: Record<NetworkType, string> = {
  mainnet: "Public Global Stellar Network ; September 2015",
  testnet: "Test SDF Network ; September 2015",
};

interface NetworkContextValue {
  network: NetworkType;
  setNetwork: (n: NetworkType) => void;
  isMainnet: boolean;
  passphrase: string;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<NetworkType>(() => {
    try {
      const stored = localStorage.getItem("sentio-network");
      return stored === "mainnet" ? "mainnet" : "testnet";
    } catch {
      return "testnet";
    }
  });

  const setNetwork = useCallback((n: NetworkType) => {
    setNetworkState(n);
    try { localStorage.setItem("sentio-network", n); } catch { /* ignore */ }
  }, []);

  return (
    <NetworkContext.Provider value={{
      network,
      setNetwork,
      isMainnet: network === "mainnet",
      passphrase: NETWORK_PASSPHRASES[network],
    }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}