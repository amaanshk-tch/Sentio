import { useWallet } from "@/contexts/WalletContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { Wallet } from "lucide-react";

export function RequireWallet({ children }: { children: React.ReactNode }) {
  const { isConnected, connect, status } = useWallet();
  const { network } = useNetwork();

  if (isConnected) return <>{children}</>;

  async function handleConnect() {
    const key = await connect();
    if (key) {
      try {
        await fetch("/api/users/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: key, network }),
        });
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <Wallet className="h-12 w-12 text-primary opacity-60" />
      <h2 className="text-xl font-semibold">Connect your wallet to access the Explorer</h2>
      <p className="text-sm text-sentio-text-muted">You need to connect your Freighter wallet to continue.</p>
      <button
        onClick={handleConnect}
        disabled={status === "connecting"}
        className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-6 py-3 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
      >
        {status === "connecting" ? "Connecting…" : "Connect Wallet"}
      </button>
    </div>
  );
}
