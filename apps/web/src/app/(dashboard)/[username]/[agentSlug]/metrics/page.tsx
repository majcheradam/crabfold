export default function MetricsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Metrics</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total tokens", value: "142,580" },
          { label: "Avg latency", value: "1.2s" },
          { label: "Cost (24h)", value: "$0.47" },
          { label: "Success rate", value: "98.2%" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 border border-border p-4"
          >
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
              {stat.label}
            </span>
            <span className="text-lg font-semibold text-foreground">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center border border-border py-20 text-xs text-muted-foreground">
        Trace waterfall and charts will appear here once the agent is deployed
      </div>
    </div>
  );
}
