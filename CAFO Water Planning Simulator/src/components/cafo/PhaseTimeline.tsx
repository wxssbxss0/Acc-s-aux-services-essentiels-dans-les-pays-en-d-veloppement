import { CheckCircle2 } from "lucide-react";

export type Phase = {
  id: 1 | 2 | 3 | 4;
  label: string;
  years: string;
  cost: number;
  newlyServed: number;
  cumCoverage: number;
  scope: string;
};

export const PHASES: Phase[] = [
  { id: 1, label: "Core Infrastructure", years: "Year 1–2", cost: 85_000, newlyServed: 450, cumCoverage: 44, scope: "Tower connection · main trunk · 3 public fountains" },
  { id: 2, label: "Network Densification", years: "Year 3–5", cost: 72_000, newlyServed: 350, cumCoverage: 78, scope: "5 more fountains · 50 household connections (dense cluster)" },
  { id: 3, label: "Expansion", years: "Year 6–10", cost: 45_000, newlyServed: 231, cumCoverage: 100, scope: "Remaining household connections (mid-distance zone)" },
  { id: 4, label: "O&M Reserves", years: "Year 11–20", cost: 22_000, newlyServed: 0, cumCoverage: 100, scope: "Pipe replacement buffer · operator training · monitoring" },
];

const TOTAL_BUDGET = 224_100;

export function PhaseTimeline({
  selected,
  onSelect,
  lang,
}: {
  selected: number | null;
  onSelect: (id: number | null) => void;
  lang: "en" | "fr";
}) {
  const labels = lang === "fr"
    ? { title: "Calendrier d'investissement sur 20 ans", sub: "4 phases · cliquez pour cibler la phase sur la carte", cost: "Coût", served: "Nouveaux bénéficiaires", coverage: "Couverture cumulée", total: "Total programme", clear: "Tout afficher" }
    : { title: "20-Year Phased Investment Plan", sub: "4 phases · click a phase to highlight it on the map", cost: "Cost", served: "Newly served", coverage: "Cumulative coverage", total: "Total program", clear: "Show all" };

  const cumCost: number[] = [];
  PHASES.reduce((acc, p, i) => { cumCost[i] = acc + p.cost; return cumCost[i]; }, 0);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold tracking-tight">{labels.title}</div>
          <div className="text-xs text-muted-foreground">{labels.sub}</div>
        </div>
        {selected !== null && (
          <button onClick={() => onSelect(null)} className="rounded-md border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted">
            {labels.clear}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PHASES.map((p, i) => {
          const active = selected === p.id;
          const widthPct = (cumCost[i] / TOTAL_BUDGET) * 100;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(active ? null : p.id)}
              className={`group relative flex flex-col rounded-lg border p-3 text-left shadow-sm transition-all ${
                active ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{p.id}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.label}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.years}</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-primary/70" style={{ width: `${widthPct}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-[10px]">
                <div>
                  <div className="text-muted-foreground">{labels.cost}</div>
                  <div className="num font-semibold">€{(p.cost / 1000).toFixed(0)}k</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{labels.served}</div>
                  <div className="num font-semibold">+{p.newlyServed}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{labels.coverage}</div>
                  <div className="num font-semibold text-primary">{p.cumCoverage}%</div>
                </div>
              </div>
              <div className="mt-2 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">{p.scope}</div>
              {p.cumCoverage === 100 && p.id === 3 && (
                <div className="absolute -right-1 -top-1">
                  <CheckCircle2 className="h-4 w-4 fill-success/20 text-success" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
