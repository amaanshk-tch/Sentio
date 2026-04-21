import { motion } from "framer-motion";
import { Search, RefreshCw, Clock, ArrowUpRight } from "lucide-react";
import type { SearchHistoryItem } from "./useSearchHistory";
import type { SearchState } from "./useExplorerSearch";

export function SearchBar({
  query,
  setQuery,
  handleSearch,
  state,
  network,
  searchHistory,
  setSearchHistory,
  isConnected,
  inputRef
}: {
  query: string;
  setQuery: (q: string) => void;
  handleSearch: (q: string, opts?: { network?: string }) => void;
  state: SearchState;
  network: "mainnet" | "testnet";
  searchHistory: SearchHistoryItem[];
  setSearchHistory: (history: SearchHistoryItem[] | []) => void;
  isConnected: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const isLoading = state.status === "loading";

  return (
    <div className="mb-10 max-w-2xl mx-auto w-full">
      <form
        onSubmit={(e) => { e.preventDefault(); handleSearch(query); }}
        className="flex flex-col sm:flex-row gap-2 shadow-sentio-lg rounded-2xl"
      >
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-sentio-text-muted" />
          <input
            ref={inputRef}
            id="explorer-search"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="GXXXXXX... or USDC or CXXXXXX... (contract)"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-2xl border border-foreground/10 bg-sentio-surface/80 py-4 pl-12 pr-4 font-mono text-sm sm:text-base text-foreground placeholder-sentio-text-muted backdrop-blur-md outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/20 shadow-inner"
          />
        </div>

        <button
          id="explorer-scan-btn"
          type="submit"
          disabled={!query.trim() || isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 text-sm sm:text-base font-bold text-primary-foreground transition hover:opacity-90 hover:shadow-sentio-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <><RefreshCw className="h-5 w-5 animate-spin" />Searching…</>
          ) : (
            <><Search className="h-5 w-5" />Search</>
          )}
        </button>
      </form>

      {state.status === "idle" && query.trim() !== "" && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-center text-[0.7rem] font-bold uppercase tracking-[0.15em] text-primary/80 animate-pulse"
        >
          Press Enter or click Search to scan
        </motion.p>
      )}

      {state.status === "idle" && (
        <div className="mt-8 space-y-12">
          <div>
            <p className="mb-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-sentio-text-muted">Quick Start</p>
            <div className="flex flex-wrap justify-center gap-2">
              {(network === "mainnet" ? [
                { label: "Kraken (mainnet)",  value: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
                { label: "USDC (mainnet)",    value: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
                { label: "AQUA (mainnet)",    value: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA" },
                { label: "Contract (mainnet)", value: "CBGSBKYMYO6OMGHQXXNOBRGVUDFUDVC2XLC3SXON5R2SNXILR7XCKKY3" },
              ] : [
                { label: "Account (testnet)",  value: "GCEYSSZIJJMOQFWY56MDVD4CKTNFG2YZAKPHZSD73PH3M7MOTPFQ647K" },
                { label: "USDC (testnet)",     value: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" },
                { label: "Asset (testnet)",    value: "GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B" },
                { label: "Contract (testnet)", value: "CBC3O34F5LTUUUSWOXTHL7QLZWCTNUYCNNL4V4F2EU5DAZ3A264UNOYA" },
              ]).map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => { setQuery(value); handleSearch(value); }}
                  className="rounded-xl border border-foreground/8 bg-sentio-surface/50 px-3 py-2 text-xs text-sentio-text-muted transition hover:text-foreground hover:bg-white/5 active:scale-95"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {searchHistory.length > 0 && isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-sentio-text-muted flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" /> Recent Scans
                </h3>
                <button
                  onClick={() => setSearchHistory([])}
                  className="text-[0.65rem] font-bold uppercase tracking-widest text-sentio-text-muted hover:text-sentio-danger transition-colors"
                >
                  Clear History
                </button>
              </div>
              <div className="flex flex-row flex-wrap gap-2">
                {searchHistory.map((item, idx) => (
                  <button
                    key={`${item.scannedAddress}-${idx}`}
                    onClick={() => { setQuery(item.scannedAddress); handleSearch(item.scannedAddress, { network: item.network }); }}
                    className="group inline-flex items-center gap-2 rounded-xl border border-foreground/6 bg-sentio-surface/40 px-3 py-2 transition-all hover:border-primary/30 hover:bg-sentio-surface/80 active:scale-[0.98]"
                  >
                    <div className={`h-2 w-2 shrink-0 rounded-full ${item.network === 'mainnet' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="font-mono text-xs text-foreground group-hover:text-primary transition-colors">
                      {item.scannedAddress.slice(0, 6)}…{item.scannedAddress.slice(-4)}
                    </span>
                    <ArrowUpRight className="h-3 w-3 shrink-0 text-sentio-text-muted opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
