import { createContext, useContext, ReactNode } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import type { FreighterStatus } from "@/hooks/useFreighter";

interface WalletContextType {
  status: FreighterStatus;
  publicKey: string | null;
  error: string | null;
  isConnected: boolean;
  connect: () => Promise<string | null>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const freighter = useFreighter();
  return (
    <WalletContext.Provider value={freighter}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
