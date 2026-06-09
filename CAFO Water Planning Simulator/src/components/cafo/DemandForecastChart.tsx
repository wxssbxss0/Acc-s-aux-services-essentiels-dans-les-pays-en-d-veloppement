import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PHASES } from "./PhaseTimeline";

type ProjPoint = { year: number; population: number; demand: number; capacity: number };

const CAPACITY = 37;
const STRESS_BAND = CAPACITY * 0.9;

export function DemandForecastChart({
  projection,
  lang,
  onYearChange,
}: {
  projection: ProjPoint[];
  lang: "en" | "fr";
  onYearChange?: (year: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [year, setYear] = useState(2045);
  const tRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) {
      if (tRef.current) clearInterval(tRef.current);
      return;
    }
    tRef.current = setInterval(() => {
      setYear((y) => {
        const next = y >= 2045 ? 2025 : y + 1;
        return next;
      });
    }, 350);
    return () => { if (tRef.current) clearInterval(tRef.current); };
  }, [playing]);

  useEffect(() => { onYearChange?.(year); }, [year, onYearChange]);

  const phaseYears = [
    { y: 2025 + 2, label: "Phase 1" },
    { y: 2025 + 5, label: "Phase 2" },
    { y: 2025 + 10, label: "Phase 3" },
    { y: 2025 + 20, label: "Phase 4" },
  ];
  const budgetDepleteYear = (() => {
    let cum = 0;
    for (const p of PHASES) {
      cum += p.cost;
      if (cum >= 220_000) {
        const idx = PHASES.indexOf(p);
        const endYearOffset = [2, 5, 10, 20][idx];
        return 2025 + endYearOffset;
      }
    }
    return null;
  })();

  const labels = lang === "fr"
    ? { title: "Prévision animée 2025 – 2045", sub: "Population · demande · capacité système · zone de stress", year: "Année", play: "Lecture", pause: "Pause", reset: "Réinitialiser", pop: "Population", dem: "Demande (m³/j)", cap: "Capacité (m³/j)", stress: "Zone de stress", budget: "Budget épuisé" }
    : { title: "Animated Demand Forecast 2025 – 2045", sub: "Population · daily demand · system capacity · stress band", year: "Year", play: "Play", pause: "Pause", reset: "Reset", pop: "Population", dem: "Demand (m³/d)", cap: "Capacity (m³/d)", stress: "Stress zone", budget: "Budget depleted" };

  const visibleData = projection.filter((p) => p.year <= year);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight">{labels.title}</div>
          <div className="text-xs text-muted-foreground">{labels.sub}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="num rounded-md border bg-primary/5 px-2 py-1 text-xs font-bold text-primary">{year}</span>
          <button onClick={() => setPlaying((p) => !p)} className="flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs font-medium hover:bg-muted">
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {playing ? labels.pause : labels.play}
          </button>
          <button onClick={() => { setPlaying(false); setYear(2025); }} className="flex items-center gap-1 rounded-md border bg-card px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted" title={labels.reset}>
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visibleData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="popGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.38 0.12 250)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="oklch(0.38 0.12 250)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="oklch(0.9 0.01 240)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="oklch(0.5 0.02 250)" type="number" domain={[2025, 2045]} allowDecimals={false} />
            <YAxis yAxisId="l" tick={{ fontSize: 11 }} stroke="oklch(0.5 0.02 250)" />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} stroke="oklch(0.5 0.02 250)" domain={[0, 45]} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceArea yAxisId="r" y1={STRESS_BAND} y2={45} fill="oklch(0.6 0.2 25)" fillOpacity={0.08} />
            {phaseYears.map((p) => (
              <ReferenceLine key={p.label} x={p.y} yAxisId="l" stroke="oklch(0.5 0.02 250)" strokeDasharray="2 3" label={{ value: p.label, position: "top", fontSize: 9, fill: "oklch(0.5 0.02 250)" }} />
            ))}
            {budgetDepleteYear && (
              <ReferenceLine x={budgetDepleteYear} yAxisId="l" stroke="oklch(0.6 0.2 25)" strokeWidth={1.5} label={{ value: labels.budget, position: "insideTopRight", fontSize: 10, fill: "oklch(0.6 0.2 25)" }} />
            )}
            <Area yAxisId="l" type="monotone" dataKey="population" name={labels.pop} stroke="oklch(0.38 0.12 250)" fill="url(#popGrad)" strokeWidth={2} />
            <Line yAxisId="r" type="monotone" dataKey="demand" name={labels.dem} stroke="oklch(0.66 0.14 235)" strokeWidth={2.5} dot={false} />
            <Line yAxisId="r" type="monotone" dataKey="capacity" name={labels.cap} stroke="oklch(0.62 0.14 155)" strokeDasharray="5 4" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm bg-[oklch(0.6_0.2_25)]/30" /> {labels.stress} (≥{STRESS_BAND.toFixed(0)} m³/d)</span>
      </div>
    </div>
  );
}
