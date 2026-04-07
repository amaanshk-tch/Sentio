import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { BrandMark } from "@/components/landing/BrandMark";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Flag } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const [secret, setSecret] = useState("");
  
  // Set Risk State
  const [riskAddress, setRiskAddress] = useState("");
  const [riskScore, setRiskScore] = useState(0);
  const [riskConfidence, setRiskConfidence] = useState(50);
  const [riskCategory, setRiskCategory] = useState("unknown");
  const [isSettingRisk, setIsSettingRisk] = useState(false);

  // Flag State
  const [flagAddress, setFlagAddress] = useState("");
  const [flagReason, setFlagReason] = useState("suspicious");
  const [flagSeverity, setFlagSeverity] = useState(50);
  const [isFlagging, setIsFlagging] = useState(false);

  const handleSetRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret || !riskAddress) {
      toast.error("Please provide the admin secret key and an address.");
      return;
    }

    setIsSettingRisk(true);
    try {
      const res = await fetch("/api/registry/set-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sending secret inside request is just for demo purposes, normally backend handles auth
         body: JSON.stringify({ 
           address: riskAddress, 
           score: riskScore, 
           confidence: riskConfidence, 
           category: riskCategory 
         }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Risk set successfully! Hash: ${data.hash}`);
        setRiskAddress("");
      } else {
        toast.error(`Error configuring risk: ${data.reason}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to set risk.");
    } finally {
      setIsSettingRisk(false);
    }
  };

  const handleFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret || !flagAddress) {
      toast.error("Please provide the admin secret key and an address.");
      return;
    }

    setIsFlagging(true);
    try {
      const res = await fetch("/api/registry/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ 
           secret,
           address: flagAddress, 
           reason: flagReason, 
           severity: flagSeverity 
         }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Flagged successfully! Hash: ${data.hash}`);
        setFlagAddress("");
      } else {
        toast.error(`Error flagging address: ${data.reason}`);
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
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-foreground/10 bg-sentio-surface/90 px-4 py-2.5 text-sm font-medium text-sentio-text-secondary shadow-sentio-sm backdrop-blur-md transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </header>

      <div className="mb-8 animate-fade-in-up">
        <span className="inline-flex rounded-full border border-foreground/8 bg-sentio-surface/50 px-3 py-1.5 text-caption-upper">
          Sentio Admin
        </span>
        <h1 className="text-display mt-4 max-w-[24ch]">
          Risk Registry <strong className="text-primary">Dashboard</strong>
        </h1>
        <p className="text-body-lg mt-3 max-w-lg">
          Configure on-chain risk parameters and flag addresses directly on the Soroban smart contract.
        </p>
      </div>

      <div className="mb-8 p-6 rounded-2xl border border-foreground/8 bg-sentio-elevated/80 w-full max-w-2xl">
         <label className="block text-sm font-medium text-sentio-text-secondary mb-2">Admin / Reporter Secret Key</label>
         <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-3 px-4 font-mono text-sm text-foreground placeholder-sentio-text-muted outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            placeholder="Your secret key"
          />
          <p className="mt-2 text-xs text-sentio-text-muted">You need this key to authorize transactions on the Soroban risk-registry contract.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-5xl">
        {/* Set Risk Form */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Set Risk Data</h2>
          </div>
          <p className="text-sm text-sentio-text-muted mb-6">Manually overwrite the on-chain risk score for a specific stellar address.</p>
          
          <form onSubmit={handleSetRisk} className="space-y-4">
            <div>
              <label className="block text-sm text-sentio-text-secondary mb-1">Target Address</label>
              <input type="text" required value={riskAddress} onChange={e => setRiskAddress(e.target.value)} className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm font-mono outline-none focus:border-primary" placeholder="G..." />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm text-sentio-text-secondary mb-1">Score (0-100)</label>
                  <input type="number" min="0" max="100" required value={riskScore} onChange={e => setRiskScore(Number(e.target.value))} className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm outline-none focus:border-primary" />
               </div>
               <div>
                  <label className="block text-sm text-sentio-text-secondary mb-1">Confidence (0-100)</label>
                  <input type="number" min="0" max="100" required value={riskConfidence} onChange={e => setRiskConfidence(Number(e.target.value))} className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm outline-none focus:border-primary" />
               </div>
            </div>

            <div>
              <label className="block text-sm text-sentio-text-secondary mb-1">Category</label>
              <input type="text" required value={riskCategory} onChange={e => setRiskCategory(e.target.value)} className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm outline-none focus:border-primary" placeholder="e.g. scam, safe, malware" />
            </div>

            <button type="submit" disabled={isSettingRisk} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {isSettingRisk ? "Broadcasting..." : "Save Risk Assessment"}
            </button>
          </form>
        </div>

        {/* Flag Form */}
        <div className="rounded-2xl border border-foreground/8 bg-sentio-elevated/80 p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Flag className="h-5 w-5 text-sentio-warning" />
            <h2 className="text-xl font-bold">Flag Address</h2>
          </div>
          <p className="text-sm text-sentio-text-muted mb-6">Report an address for suspicious behavior. This adds a flag history to the registry.</p>
          
          <form onSubmit={handleFlag} className="space-y-4">
            <div>
              <label className="block text-sm text-sentio-text-secondary mb-1">Suspect Address</label>
              <input type="text" required value={flagAddress} onChange={e => setFlagAddress(e.target.value)} className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm font-mono outline-none focus:border-primary" placeholder="G..." />
            </div>

            <div>
              <label className="block text-sm text-sentio-text-secondary mb-1">Reason</label>
              <input type="text" required value={flagReason} onChange={e => setFlagReason(e.target.value)} maxLength={32} className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm outline-none focus:border-primary" placeholder="e.g. phishing, theft" />
            </div>

            <div>
              <label className="block text-sm text-sentio-text-secondary mb-1">Severity (0-100)</label>
              <input type="number" min="0" max="100" required value={flagSeverity} onChange={e => setFlagSeverity(Number(e.target.value))} className="w-full rounded-xl border border-foreground/10 bg-sentio-surface/80 py-2.5 px-3 text-sm outline-none focus:border-primary" />
            </div>

            <button type="submit" disabled={isFlagging} className="mt-4 w-full rounded-xl bg-sentio-warning px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {isFlagging ? "Broadcasting..." : "Submit Flag"}
            </button>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
