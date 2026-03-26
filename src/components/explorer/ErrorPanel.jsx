import { AlertTriangle } from "lucide-react";

export function ErrorPanel({ message }) {
  return (
    <div className="rounded-sentio-2xl border border-rose-400/22 bg-rose-500/8 p-6 shadow-sentio-md backdrop-blur-xl sm:p-7">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-500/15 ring-1 ring-rose-400/25">
          <AlertTriangle className="h-5 w-5 text-rose-100" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sentio-text">Scan failed</p>
          <p className="mt-2 text-sm leading-relaxed text-sentio-text-secondary">{message}</p>
          <p className="mt-4 text-xs leading-relaxed text-sentio-text-muted">
            Use a Stellar public key (starts with <span className="font-mono text-sentio-text-secondary">G</span>) or{" "}
            <span className="font-mono text-sentio-text-secondary">CODE:ISSUER</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
