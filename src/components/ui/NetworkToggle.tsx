import { useNetwork, type NetworkType } from "@/contexts/NetworkContext";

const networks: { value: NetworkType; label: string; dot: string }[] = [
  { value: "testnet", label: "Testnet", dot: "bg-amber-400" },
  { value: "mainnet", label: "Mainnet", dot: "bg-emerald-400" },
];

export function NetworkToggle() {
  const { network, setNetwork } = useNetwork();

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-foreground/10 bg-sentio-surface/80 p-1 backdrop-blur-md shadow-sentio-sm">
      {networks.map(({ value, label, dot }) => {
        const active = network === value;
        return (
          <button
            key={value}
            onClick={() => setNetwork(value)}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              active
                ? "bg-sentio-surface text-foreground shadow-sentio-sm"
                : "text-sentio-text-muted hover:text-foreground",
            ].join(" ")}
            aria-pressed={active}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dot} ${active ? "opacity-100" : "opacity-40"}`} />
            {label}
          </button>
        );
      })}
    </div>
  );
}