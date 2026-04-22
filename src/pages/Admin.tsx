const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
import { useState, useRef, useEffect, useCallback } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { BrandMark } from "@/components/landing/BrandMark";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Flag, Lock, Wallet, CheckCircle, AlertCircle, Copy, Eraser, Trash2 } from "lucide-react";
import { isConnected, getAddress, requestAccess, signTransaction } from "@stellar/freighter-api";
import { toast } from "sonner";
import { useNetwork } from "@/contexts/NetworkContext";


export default function Admin() {
  const { passphrase: networkPassphrase } = useNetwork();
  const [token, setToken]       = useState("");
  const tokenRef                = useRef("");
  const [unlocked, setUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletVerified, setWalletVerified] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performLogout = useCallback(() => {
    setToken("");
    tokenRef.current = "";
    setUnlocked(false);
    setWalletAddress(null);
    setWalletVerified(false);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!unlocked) return;
    timeoutRef.current = setTimeout(() => {
      performLogout();
      toast("Session expired due to inactivity.");
    }, 15 * 60 * 1000);
  }, [unlocked, performLogout]);

  useEffect(() => {
    if (!unlocked) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
    };
  }, [unlocked, resetIdleTimer]);

  const handleUnlock = async () => {
    if (!token.trim()) return;
    setIsUnlocking(true);
    try {
      const res = await fetch(`${API_BASE}/api/registry/verify-token`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        tokenRef.current = token;
        setToken("");
        setUnlocked(true);
        toast.success("Dashboard unlocked.");
      } else {
        toast.error("Invalid admin token.");
      }
    } catch {
      toast.error("Failed to verify token.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleConnect = async () => {
    try {
      if (!await isConnected()) {
        toast.error("Freighter extension not found. Please install it.");
        window.open("https://www.freighter.app/", "_blank");
        return;
      }
      await requestAccess();
      const data = await getAddress();
      if (!data?.address) { toast.error("Could not get wallet address."); return; }

      setWalletAddress(data.address);

      const res = await fetch(`${API_BASE}/api/registry/verify-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ signerAddress: data.address }),
      });
      const result = await res.json();

      if (res.ok && result.authorized) {
        setWalletVerified(true);
        toast.success("Wallet verified — you are the contract admin.");
      } else {
        setWalletVerified(false);
        toast.error(result.error ?? "Not authorized. This wallet is not the contract admin.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to connect wallet.");
    }
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    setWalletVerified(false);
  };

  const signAndSubmit = async (unsignedXdr: string): Promise<{ hash: string } | null> => {
    try {
      const result = await signTransaction(unsignedXdr, { networkPassphrase });
      if (!result?.signedTxXdr) throw new Error("Freighter did not return a signed transaction.");

      const submitRes = await fetch(`${API_BASE}/api/registry/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ signedXdr: result.signedTxXdr }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitData.error ?? "Submit failed.");
      return { hash: submitData.hash };
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : "Transaction failed.");
    }
  };

  const [riskAddress, setRiskAddress]       = useState("");
  const [riskScore, setRiskScore]           = useState(0);
  const [riskConfidence, setRiskConfidence] = useState(50);
  const [riskCategory, setRiskCategory]     = useState("unknown");
  const [isSettingRisk, setIsSettingRisk]   = useState(false);
  const [lastRiskHash, setLastRiskHash]     = useState<string | null>(null);

  const handleSetRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletVerified) { toast.error("Connect and verify your wallet first."); return; }
    setIsSettingRisk(true);
    try {
      const res = await fetch(`${API_BASE}/api/registry/set-risk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokenRef.current}` },
        body: JSON.stringify({
          address: riskAddress, score: riskScore,
          confidence: riskConfidence, category: riskCategory,
          signerAddress: walletAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to build transaction.");
        return;
      }

      const submitted = await signAndSubmit(data.unsignedXdr);
      if (submitted) {
        toast.success(`Risk set successfully!`);
        setRiskAddress("");
        setLastRiskHash(submitted.hash);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to set risk.");
    } finally {
      setIsSettingRisk(false);
    }
  };

  const [flagAddress, setFlagAddress]   = useState("");
  const [flagReason, setFlagReason]     = useState("suspicious");
  const [flagSeverity, setFlagSeverity] = useState(50);
  const [isFlagging, setIsFlagging]     = useState(false);
  const [lastFlagHash, setLastFlagHash] = useState<string | null>(null);

  const handleFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletVerified) { toast.error("Connect and verify your wallet first."); return; }
    setIsFlagging(true);
    try {
      const res = await fetch(`${API_BASE}/api/registry/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokenRef.current}` },
        body: JSON.stringify({
          address: flagAddress, reason: flagReason,
          severity: flagSeverity, signerAddress: walletAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to build transaction.");
        return;
      }

      const submitted = await signAndSubmit(data.unsignedXdr);
      if (submitted) {
        toast.success(`Flagged successfully!`);
        setFlagAddress("");
        setLastFlagHash(submitted.hash);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to flag.");
    } finally {
      setIsFlagging(false);
    }
  };

  const [clearAddress, setClearAddress] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [lastClearHash, setLastClearHash] = useState<string | null>(null);

  const handleClearFlags = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletVerified) { toast.error("Connect and verify your wallet first."); return; }
    setIsClearing(true);
    try {
      const res = await fetch(`${API_BASE}/api/registry/clear-flags`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ address: clearAddress, signerAddress: walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed."); return; }
      const submitted = await signAndSubmit(data.unsignedXdr);
      if (submitted) { 
        toast.success("Flags cleared."); 
        setClearAddress(""); 
        setLastClearHash(submitted.hash);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    } finally {
      setIsClearing(false);
    }
  };

  const [removeAddress, setRemoveAddress] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);
  const [lastRemoveHash, setLastRemoveHash] = useState<string | null>(null);

  const handleRemoveRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletVerified) { toast.error("Connect and verify your wallet first."); return; }
    setIsRemoving(true);
    try {
      const res = await fetch(`${API_BASE}/api/registry/remove-risk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ address: removeAddress, signerAddress: walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed."); return; }
      const submitted = await signAndSubmit(data.unsignedXdr);
      if (submitted) { 
        toast.success("Risk record removed."); 
        setRemoveAddress(""); 
        setLastRemoveHash(submitted.hash);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed.");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <PageLayout>
      <header className="flex items-center justify-between gap-4 py-5">
        <BrandMark to="/" size="lg" />
        <div className="flex items-center gap-3">

          {unlocked && (
            <button
              onClick={walletAddress ? handleDisconnect : handleConnect}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sentio-sm backdrop-blur-md transition active:scale-95 ${
                walletVerified
                  ? "border-sentio-success/30 bg-sentio-success/10 text-sentio-success hover:bg-sentio-success/20"
                  : walletAddress
                    ? "border-sentio-danger/30 bg-sentio-danger/10 text-sentio-danger hover:bg-sentio-danger/20"
                    : "border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/30"
              }`}
            >
              {walletVerified
                ? <><CheckCircle className="h-4 w-4" /> {walletAddress!.slice(0, 4)}...{walletAddress!.slice(-4)}</>
                : walletAddress
                  ? <><AlertCircle className="h-4 w-4" /> Not Authorized</>
                  : <><Wallet className="h-4 w-4" /> Connect Wallet</>
              }
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

      {!unlocked ? (
        <div className="mb-8 p-6 rounded-2xl border border-foreground/8 bg-sentio-elevated/80 w-full max-w-md">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Enter admin token</h2>
          </div>
          <p className="text-sm text-sentio-text-muted mb-4">
            This is the <code className="text-xs bg-white/10 rounded px-1 py-0.5">SENTIO_ADMIN_TOKEN</code> set in your server environment.
          </p>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-3 px-4 font-mono text-sm text-foreground placeholder-sentio-text-muted outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15 mb-3"
            placeholder="Paste admin token..."
            onKeyDown={e => { if (e.key === "Enter" && token.trim()) handleUnlock(); }}
          />
          <button
            onClick={handleUnlock}
            disabled={!token.trim() || isUnlocking}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isUnlocking ? "Verifying..." : "Unlock Dashboard"}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between max-w-5xl">
            <div className="flex items-center gap-4 text-sm">
              <p className="text-sentio-success flex items-center gap-2">
                <Lock className="h-4 w-4" /> Authenticated
              </p>
              {!walletAddress ? (
                <p className="text-sentio-text-muted flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Connect your Freighter wallet to sign transactions
                </p>
              ) : walletVerified ? (
                <p className="text-sentio-success flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Contract admin verified
                </p>
              ) : (
                <p className="text-sentio-danger flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Wrong wallet — not the contract admin
                </p>
              )}
            </div>
            <button
              onClick={performLogout}
              className="text-xs text-sentio-text-muted hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>

          {!walletVerified && (
            <div className="mb-6 max-w-5xl rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Connect your Freighter wallet</p>
                <p className="text-xs text-sentio-text-muted mt-1">
                  You must connect the same wallet used to initialize the contract. 
                  Transactions will be signed by Freighter — your key never leaves your browser.
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                <Wallet className="h-4 w-4" />
                {walletAddress ? "Retry" : "Connect Wallet"}
              </button>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 max-w-5xl">
            <div className={`rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 space-y-4 transition-opacity ${!walletVerified ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Set Risk Data</h2>
              </div>
              <p className="text-sm text-sentio-text-muted">
                Manually overwrite the on-chain risk score. Freighter will prompt you to sign.
              </p>
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
                  {isSettingRisk ? "Waiting for Freighter..." : "Save Risk Assessment"}
                </button>
                {lastRiskHash && (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-sentio-success/20 bg-sentio-success/10 p-3">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-xs font-bold text-sentio-success uppercase tracking-wider mb-0.5">Transaction Hash</span>
                      <span className="truncate font-mono text-xs text-sentio-text-secondary" title={lastRiskHash}>{lastRiskHash}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(lastRiskHash); toast.success("Hash copied!"); }}
                      className="shrink-0 rounded-lg p-2 text-sentio-success hover:bg-sentio-success/20 transition"
                      title="Copy Hash"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </form>
            </div>

            <div className={`rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 space-y-4 transition-opacity ${!walletVerified ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-sentio-warning" />
                <h2 className="text-xl font-bold">Flag Address</h2>
              </div>
              <p className="text-sm text-sentio-text-muted">
                Report a suspicious address. Freighter will prompt you to sign.
              </p>
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
                  {isFlagging ? "Waiting for Freighter..." : "Submit Flag"}
                </button>
                {lastFlagHash && (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-sentio-success/20 bg-sentio-success/10 p-3">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-xs font-bold text-sentio-success uppercase tracking-wider mb-0.5">Transaction Hash</span>
                      <span className="truncate font-mono text-xs text-sentio-text-secondary" title={lastFlagHash}>{lastFlagHash}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(lastFlagHash); toast.success("Hash copied!"); }}
                      className="shrink-0 rounded-lg p-2 text-sentio-success hover:bg-sentio-success/20 transition"
                      title="Copy Hash"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </form>
            </div>

            <div className={`rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 space-y-4 transition-opacity ${!walletVerified ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center gap-2">
                <Eraser className="h-5 w-5 text-sentio-success" />
                <h2 className="text-xl font-bold">Clear Flags</h2>
              </div>
              <p className="text-sm text-sentio-text-muted">
                Remove all flags for a specific address. Freighter will prompt you to sign.
              </p>
              <form onSubmit={handleClearFlags} className="space-y-4">
                <div>
                  <label className="block text-sm text-sentio-text-secondary mb-1">Target Address</label>
                  <input type="text" required value={clearAddress} onChange={e => setClearAddress(e.target.value)}
                    className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm font-mono outline-none focus:border-primary"
                    placeholder="G..." />
                </div>
                <button type="submit" disabled={isClearing}
                  className="mt-2 w-full rounded-xl bg-sentio-success px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {isClearing ? "Waiting for Freighter..." : "Clear Flags"}
                </button>
                {lastClearHash && (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-sentio-success/20 bg-sentio-success/10 p-3">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-xs font-bold text-sentio-success uppercase tracking-wider mb-0.5">Transaction Hash</span>
                      <span className="truncate font-mono text-xs text-sentio-text-secondary" title={lastClearHash}>{lastClearHash}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(lastClearHash); toast.success("Hash copied!"); }}
                      className="shrink-0 rounded-lg p-2 text-sentio-success hover:bg-sentio-success/20 transition"
                      title="Copy Hash"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </form>
            </div>

            <div className={`rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 space-y-4 transition-opacity ${!walletVerified ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-sentio-danger" />
                <h2 className="text-xl font-bold">Remove Risk Record</h2>
              </div>
              <p className="text-sm text-sentio-text-muted">
                Delete the entire risk assessment record for an address. Freighter will prompt you to sign.
              </p>
              <form onSubmit={handleRemoveRisk} className="space-y-4">
                <div>
                  <label className="block text-sm text-sentio-text-secondary mb-1">Target Address</label>
                  <input type="text" required value={removeAddress} onChange={e => setRemoveAddress(e.target.value)}
                    className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm font-mono outline-none focus:border-primary"
                    placeholder="G..." />
                </div>
                <button type="submit" disabled={isRemoving}
                  className="mt-2 w-full rounded-xl bg-sentio-danger px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {isRemoving ? "Waiting for Freighter..." : "Remove Risk Record"}
                </button>
                {lastRemoveHash && (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-sentio-success/20 bg-sentio-success/10 p-3">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-xs font-bold text-sentio-success uppercase tracking-wider mb-0.5">Transaction Hash</span>
                      <span className="truncate font-mono text-xs text-sentio-text-secondary" title={lastRemoveHash}>{lastRemoveHash}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(lastRemoveHash); toast.success("Hash copied!"); }}
                      className="shrink-0 rounded-lg p-2 text-sentio-success hover:bg-sentio-success/20 transition"
                      title="Copy Hash"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}