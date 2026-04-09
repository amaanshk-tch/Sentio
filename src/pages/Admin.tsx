import { useState, useEffect } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { BrandMark } from "@/components/landing/BrandMark";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Flag, Lock, Wallet } from "lucide-react";
import { isConnected, getAddress, setAllowed } from "@stellar/freighter-api";
import { toast } from "sonner";

// The admin token is set in your .env as VITE_ADMIN_TOKEN (frontend) and
// SENTIO_ADMIN_TOKEN (server). It is NOT a Stellar secret key — it's just
// a password that lets you call the protected server endpoints.
// Generate one with: openssl rand -hex 32
const ENV_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || "";

export default function Admin() {
  const [token, setToken] = useState(ENV_TOKEN);
  const [unlocked, setUnlocked] = useState(Boolean(ENV_TOKEN));
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (await isConnected()) {
          const data = await getAddress();
          if (data && data.address) setWalletAddress(data.address);
        }
      } catch (err) {
        console.error("Freighter connection check failed", err);
      }
    };
    checkConnection();
  }, []);

  const handleConnect = async () => {
    try {
      if (!await isConnected()) {
        toast.error("Freighter extension not found. Please install it.");
        window.open("https://www.freighter.app/", "_blank");
        return;
      }
      // Trigger the Freighter permission popup
      await setAllowed();

      const data = await getAddress();
      if (data && data.address) {
        setWalletAddress(data.address);
        toast.success("Wallet connected!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to connect wallet.");
    }
  };

  // Set Risk State
  const [riskAddress, setRiskAddress]     = useState("");
  const [riskScore, setRiskScore]         = useState(0);
  const [riskConfidence, setRiskConfidence] = useState(50);
  const [riskCategory, setRiskCategory]   = useState("unknown");
  const [isSettingRisk, setIsSettingRisk] = useState(false);

  // Flag State
  const [flagAddress, setFlagAddress]   = useState("");
  const [flagReason, setFlagReason]     = useState("suspicious");
  const [flagSeverity, setFlagSeverity] = useState(50);
  const [isFlagging, setIsFlagging]     = useState(false);

  const authHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  const handleSetRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riskAddress) { toast.error("Please provide a target address."); return; }
    setIsSettingRisk(true);
    try {
      const res = await fetch("/api/registry/set-risk", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ address: riskAddress, score: riskScore, confidence: riskConfidence, category: riskCategory }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Risk set! Hash: ${data.hash}`);
        setRiskAddress("");
      } else if (res.status === 401) {
        toast.error("Invalid admin token. Check your VITE_ADMIN_TOKEN.");
      } else {
        toast.error(`Error: ${data.error || data.reason}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to set risk.");
    } finally {
      setIsSettingRisk(false);
    }
  };

  const handleFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagAddress) { toast.error("Please provide a target address."); return; }
    setIsFlagging(true);
    try {
      const res = await fetch("/api/registry/report", {
        method: "POST",
        headers: authHeaders,
        // Note: the server uses SENTIO_ADMIN_SECRET from env to sign the Soroban tx.
        // We pass the reporter's Stellar address if needed, but NOT a private key.
        body: JSON.stringify({ address: flagAddress, reason: flagReason, severity: flagSeverity }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Flagged! Hash: ${data.hash}`);
        setFlagAddress("");
      } else if (res.status === 401) {
        toast.error("Invalid admin token. Check your VITE_ADMIN_TOKEN.");
      } else {
        toast.error(`Error: ${data.error || data.reason}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to flag.");
    } finally {
      setIsFlagging(false);
    }
  };

  return (
    <PageLayout>
      <header className="flex items-center justify-between gap-4 py-5">
        <BrandMark to="/" size="lg" />
        <div className="flex items-center gap-3">
          {unlocked && (
            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary shadow-sentio-sm backdrop-blur-md transition hover:bg-primary/20 hover:border-primary/30 active:scale-95"
            >
              <Wallet className="h-4 w-4" />
              {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : "Connect Wallet"}
            </button>
          )}
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-foreground/10 bg-sentio-surface/90 px-4 py-2.5 text-sm font-medium text-sentio-text-secondary shadow-sentio-sm backdrop-blur-md transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>

      <div className="mb-8 animate-fade-in-up">
        <span className="inline-flex rounded-full border border-foreground/8 bg-sentio-surface/50 px-3 py-1.5 text-caption-upper">
          Sentio Admin
        </span>
        <h1 className="text-display mt-4 max-w-[24ch]">
          Risk Registry <strong className="text-primary">Dashboard</strong>
        </h1>
        <p className="text-body-lg mt-3 max-w-lg">
          Configure on-chain risk parameters and flag addresses on the Soroban smart contract.
        </p>
      </div>

      {/* Token gate */}
      {!unlocked ? (
        <div className="mb-8 p-6 rounded-2xl border border-foreground/8 bg-sentio-elevated/80 w-full max-w-md">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Enter admin token</h2>
          </div>
          <p className="text-sm text-sentio-text-muted mb-4">
            This is the <code className="text-xs bg-white/10 rounded px-1 py-0.5">SENTIO_ADMIN_TOKEN</code> you set in your server environment — not a Stellar secret key.
          </p>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-3 px-4 font-mono text-sm text-foreground placeholder-sentio-text-muted outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15 mb-3"
            placeholder="Paste admin token..."
            onKeyDown={e => { if (e.key === "Enter" && token.trim()) setUnlocked(true); }}
          />
          <button
            onClick={() => { if (token.trim()) setUnlocked(true); }}
            disabled={!token.trim()}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Unlock Dashboard
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between max-w-5xl">
            <p className="text-sm text-sentio-success flex items-center gap-2">
              <Lock className="h-4 w-4" /> Authenticated
            </p>
            <button
              onClick={() => { setToken(""); setUnlocked(false); }}
              className="text-xs text-sentio-text-muted hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-5xl">
            {/* Set Risk Form */}
            <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Set Risk Data</h2>
              </div>
              <p className="text-sm text-sentio-text-muted">Manually overwrite the on-chain risk score for a Stellar address.</p>

              <form onSubmit={handleSetRisk} className="space-y-4">
                <div>
                  <label className="block text-sm text-sentio-text-secondary mb-1">Target Address</label>
                  <input type="text" required value={riskAddress} onChange={e => setRiskAddress(e.target.value)}
                    className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm font-mono outline-none focus:border-primary"
                    placeholder="G..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-sentio-text-secondary mb-1">Score (0-100)</label>
                    <input type="number" min="0" max="100" required value={riskScore} onChange={e => setRiskScore(Number(e.target.value))}
                      className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-sm text-sentio-text-secondary mb-1">Confidence (0-100)</label>
                    <input type="number" min="0" max="100" required value={riskConfidence} onChange={e => setRiskConfidence(Number(e.target.value))}
                      className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm outline-none focus:border-primary" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-sentio-text-secondary mb-1">Category</label>
                  <input type="text" required value={riskCategory} onChange={e => setRiskCategory(e.target.value)}
                    className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm outline-none focus:border-primary"
                    placeholder="e.g. scam, safe, malware" maxLength={32} />
                </div>
                <button type="submit" disabled={isSettingRisk}
                  className="mt-2 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {isSettingRisk ? "Broadcasting..." : "Save Risk Assessment"}
                </button>
              </form>
            </div>

            {/* Flag Form */}
            <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-sentio-warning" />
                <h2 className="text-xl font-bold">Flag Address</h2>
              </div>
              <p className="text-sm text-sentio-text-muted">Report an address for suspicious behavior on the registry.</p>

              <form onSubmit={handleFlag} className="space-y-4">
                <div>
                  <label className="block text-sm text-sentio-text-secondary mb-1">Suspect Address</label>
                  <input type="text" required value={flagAddress} onChange={e => setFlagAddress(e.target.value)}
                    className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm font-mono outline-none focus:border-primary"
                    placeholder="G..." />
                </div>
                <div>
                  <label className="block text-sm text-sentio-text-secondary mb-1">Reason</label>
                  <input type="text" required value={flagReason} onChange={e => setFlagReason(e.target.value)} maxLength={64}
                    className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm outline-none focus:border-primary"
                    placeholder="e.g. phishing, theft" />
                </div>
                <div>
                  <label className="block text-sm text-sentio-text-secondary mb-1">Severity (0-100)</label>
                  <input type="number" min="0" max="100" required value={flagSeverity} onChange={e => setFlagSeverity(Number(e.target.value))}
                    className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm outline-none focus:border-primary" />
                </div>
                <button type="submit" disabled={isFlagging}
                  className="mt-2 w-full rounded-xl bg-sentio-warning px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {isFlagging ? "Broadcasting..." : "Submit Flag"}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}
