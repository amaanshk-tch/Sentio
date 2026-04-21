import { Wallet, LogOut, Loader2, AlertCircle } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";

interface WalletConnectProps {
  onConnected?: (publicKey: string) => void;
  compact?: boolean;
}

function shortKey(key: string) {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function WalletConnect({ onConnected, compact = false }: WalletConnectProps) {
  const { status, publicKey, error, connect, disconnect } = useWallet();

  async function handleConnect() {
    const key = await connect();
    if (key && onConnected) onConnected(key);
  }

  if (status === "checking") {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-foreground/10 bg-sentio-surface/80 px-4 py-2.5 text-sm text-sentio-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        {!compact && <span>Checking wallet…</span>}
      </div>
    );
  }

  if (status === "connected" && publicKey) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-sentio-success/30 bg-sentio-success/10 px-4 py-2.5 text-sm font-medium text-sentio-success">
        <span className="h-2 w-2 rounded-full bg-sentio-success animate-pulse" />
        <span className="font-mono">{shortKey(publicKey)}</span>
        <button
          onClick={disconnect}
          className="ml-1 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity"
          title="Disconnect"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (status === "not_installed") {
    return (
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-sentio-warning/30 bg-sentio-warning/10 px-4 py-2.5 text-sm font-medium text-sentio-warning hover:bg-sentio-warning/20 transition-colors"
      >
        <AlertCircle className="h-4 w-4" />
        {!compact && <span>Install Freighter</span>}
      </a>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleConnect}
        disabled={status === "connecting"}
        className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
      >
        {status === "connecting" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        {!compact && (
          <span>{status === "connecting" ? "Connecting…" : "Connect Wallet"}</span>
        )}
      </button>
      {error && status === "error" && (
        <p className="text-xs text-sentio-danger">{error}</p>
      )}
    </div>
  );
}