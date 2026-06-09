import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Droplets, Heart, ShieldCheck, TrendingUp, Users, X } from "lucide-react";
import { PHASES } from "./PhaseTimeline";

type Scenario = { name: string; coverage: number; cost: number; sustainability: number; risk: string };

export function PitchMode({
  open, onClose, lang, recommended, scenarios, populationServed, confidence,
}: {
  open: boolean;
  onClose: () => void;
  lang: "en" | "fr";
  recommended: Scenario;
  scenarios: Scenario[];
  populationServed: number;
  confidence: number;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(5, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const T = lang === "fr" ? {
    titles: ["Le problème", "Le village", "La solution", "Modèle financier 20 ans", "Impact social", "Pourquoi investir maintenant"],
    nav: (i: number, n: number) => `Diapositive ${i} / ${n}`,
    exit: "Quitter",
  } : {
    titles: ["The Problem", "The Village", "Proposed Solution", "20-Year Financial Model", "Social Impact", "Why Invest Now"],
    nav: (i: number, n: number) => `Slide ${i} / ${n}`,
    exit: "Exit",
  };

  const slides = [
    () => (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">{lang === "fr" ? "Problème" : "Problem"}</div>
        <h2 className="text-5xl font-bold leading-tight">{lang === "fr" ? "1 milliard de personnes n'ont pas d'eau potable fiable." : "1 billion people lack reliable drinking water."}</h2>
        <p className="text-lg text-muted-foreground">{lang === "fr" ? "Dans la Préfecture de Boké, en Guinée, 1 031 villageois passent jusqu'à 2 heures par jour à chercher de l'eau dans des puits ouverts contaminés (200–600 UFC/100 mL)." : "In Préfecture de Boké, Guinea, 1,031 villagers spend up to 2 hours daily fetching water from open wells contaminated at 200–600 CFU/100mL."}</p>
        <div className="grid grid-cols-3 gap-6 pt-6">
          <BigStat label={lang === "fr" ? "Habitants sans accès" : "People without access"} value="1,031" />
          <BigStat label={lang === "fr" ? "Heures/jour perdues" : "Hours/day lost"} value="2.0" />
          <BigStat label={lang === "fr" ? "L/pers/jour actuel" : "Current L/p/day"} value="17.2" sub={lang === "fr" ? "OMS ≥ 20" : "WHO ≥ 20"} />
        </div>
      </div>
    ),
    () => (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">{lang === "fr" ? "Le terrain" : "The Field"}</div>
        <h2 className="text-4xl font-bold leading-tight">{lang === "fr" ? "Village guinéen · Préfecture de Boké" : "Guinean village · Préfecture de Boké"}</h2>
        <div className="rounded-xl border bg-gradient-to-br from-water/5 to-primary/5 p-8">
          <div className="grid grid-cols-2 gap-6 text-sm">
            <StatRow label={lang === "fr" ? "Coordonnées" : "Coordinates"} value="10.990°N · −11.435°E" />
            <StatRow label={lang === "fr" ? "Population 2025" : "Population 2025"} value="1,031" />
            <StatRow label={lang === "fr" ? "Ménages" : "Households"} value="170" />
            <StatRow label={lang === "fr" ? "Au-dessus gravité (>373m)" : "Above gravity (>373m)"} value="3" tone="warn" />
            <StatRow label={lang === "fr" ? "Château d'eau" : "Water tower"} value="40 m³ · 373 m NGF" />
            <StatRow label={lang === "fr" ? "Rendement durable" : "Sustainable yield"} value="37 m³/jour" />
            <StatRow label={lang === "fr" ? "Distance maximale" : "Max distance"} value="2,062 m" />
            <StatRow label={lang === "fr" ? "Système" : "System"} value={lang === "fr" ? "Gravitaire" : "Gravity-fed"} />
          </div>
        </div>
      </div>
    ),
    () => (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">{lang === "fr" ? "Solution recommandée" : "Recommended Solution"}</div>
        <h2 className="text-4xl font-bold leading-tight">{recommended.name}</h2>
        <p className="text-base text-muted-foreground">{lang === "fr" ? "Le meilleur équilibre couverture / coût / durabilité — dans l'enveloppe de €220,000." : "The best balance of coverage, cost and sustainability — within the €220,000 envelope."}</p>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-3 text-left">{lang === "fr" ? "Scénario" : "Scenario"}</th><th className="px-4 py-3 text-right">{lang === "fr" ? "Couverture" : "Coverage"}</th><th className="px-4 py-3 text-right">CAPEX</th><th className="px-4 py-3 text-right">{lang === "fr" ? "Durabilité" : "Sustainability"}</th><th className="px-4 py-3 text-right">{lang === "fr" ? "Risque" : "Risk"}</th></tr>
            </thead>
            <tbody className="num">
              {scenarios.map((s) => {
                const best = s.name === recommended.name;
                return (
                  <tr key={s.name} className={`border-t ${best ? "bg-primary/5" : ""}`}>
                    <td className={`px-4 py-3 font-medium ${best ? "text-primary" : ""}`}>{s.name} {best && <span className="ml-1.5 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase">★</span>}</td>
                    <td className="px-4 py-3 text-right">{s.coverage.toFixed(0)}%</td>
                    <td className="px-4 py-3 text-right">€{Math.round(s.cost).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{s.sustainability}/100</td>
                    <td className="px-4 py-3 text-right">{s.risk}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    ),
    () => {
      const cum: number[] = []; PHASES.reduce((acc, p, i) => { cum[i] = acc + p.cost; return cum[i]; }, 0);
      return (
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">{lang === "fr" ? "Modèle financier" : "Financial model"}</div>
          <h2 className="text-4xl font-bold leading-tight">{lang === "fr" ? "4 phases · €224k sur 20 ans" : "4 phases · €224k over 20 years"}</h2>
          <div className="grid grid-cols-4 gap-3">
            {PHASES.map((p, i) => (
              <div key={p.id} className="rounded-lg border bg-card p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.years}</div>
                <div className="mt-1 text-sm font-semibold">{p.label}</div>
                <div className="num mt-3 text-2xl font-bold text-primary">€{(p.cost / 1000).toFixed(0)}k</div>
                <div className="num mt-1 text-[11px] text-muted-foreground">{lang === "fr" ? "Cumul" : "Cumulative"}: €{(cum[i] / 1000).toFixed(0)}k</div>
                <div className="mt-2 h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(cum[i] / 224_100) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <strong className="text-primary">€{Math.round(recommended.cost / populationServed)} </strong> {lang === "fr" ? "par bénéficiaire sur 20 ans · " : "per beneficiary over 20 years · "}
            <strong>~€11</strong> {lang === "fr" ? "par personne par an — moins qu'une recharge mobile mensuelle." : "per person per year — less than a monthly phone top-up."}
          </div>
        </div>
      );
    },
    () => (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">{lang === "fr" ? "Impact humain" : "Human Impact"}</div>
        <h2 className="text-4xl font-bold leading-tight">{lang === "fr" ? "Au-delà de l'infrastructure : des vies transformées." : "Beyond infrastructure: lives transformed."}</h2>
        <div className="grid grid-cols-3 gap-4">
          <ImpactCard icon={<Users className="h-6 w-6" />} value={populationServed.toLocaleString()} label={lang === "fr" ? "Personnes desservies" : "People served"} />
          <ImpactCard icon={<Heart className="h-6 w-6" />} value={Math.round(populationServed * 0.51).toLocaleString()} label={lang === "fr" ? "Femmes bénéficiaires" : "Women benefiting"} accent />
          <ImpactCard icon={<Users className="h-6 w-6" />} value={Math.round(populationServed * 0.42).toLocaleString()} label={lang === "fr" ? "Enfants bénéficiaires" : "Children benefiting"} accent />
          <ImpactCard icon={<TrendingUp className="h-6 w-6" />} value={Math.round((populationServed * 1.5 * 365) / 1000) + "k"} label={lang === "fr" ? "Heures/an gagnées" : "Hours/year saved"} />
          <ImpactCard icon={<Droplets className="h-6 w-6" />} value="20+ L" label={lang === "fr" ? "/pers/jour (OMS ✓)" : "/p/day (WHO ✓)"} />
          <ImpactCard icon={<ShieldCheck className="h-6 w-6" />} value="0 UFC" label={lang === "fr" ? "Eau testée conforme" : "Tested potable"} />
        </div>
      </div>
    ),
    () => (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">{lang === "fr" ? "Décision" : "Decision"}</div>
        <h2 className="text-5xl font-bold leading-tight">{lang === "fr" ? "Pourquoi investir maintenant ?" : "Why invest now?"}</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3 rounded-xl border bg-card p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{lang === "fr" ? "Matrice de risque" : "Risk Matrix"}</div>
            <RiskLine label={lang === "fr" ? "Technique" : "Technical"} level="LOW" />
            <RiskLine label={lang === "fr" ? "Financier" : "Financial"} level="MEDIUM" />
            <RiskLine label={lang === "fr" ? "Maintenance" : "Maintenance"} level="MEDIUM" />
            <RiskLine label={lang === "fr" ? "Disponibilité eau" : "Water availability"} level="LOW" />
            <RiskLine label={lang === "fr" ? "Acceptation" : "Acceptance"} level="LOW" />
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-water/10 p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{lang === "fr" ? "Score de confiance" : "Confidence Score"}</div>
            <div className="num mt-2 text-7xl font-bold text-primary">{confidence}%</div>
            <div className="mt-4 text-sm text-muted-foreground">{lang === "fr" ? "Conception éprouvée · données géoréférencées · ROI social ×4" : "Proven design · georeferenced data · 4× social ROI"}</div>
          </div>
        </div>
        <div className="rounded-xl border border-primary bg-primary/5 p-6 text-center">
          <div className="text-2xl font-bold text-primary">€224,100 · 20 {lang === "fr" ? "ans" : "years"} · 1,031 {lang === "fr" ? "vies" : "lives"}</div>
        </div>
      </div>
    ),
  ];

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{T.titles[idx]}</div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="num">{T.nav(idx + 1, slides.length)}</span>
          <button onClick={onClose} className="flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <X className="h-3.5 w-3.5" /> {T.exit}
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        {slides[idx]()}
      </div>
      <div className="flex items-center justify-between border-t bg-card px-6 py-3">
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-sm font-medium disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" /> {lang === "fr" ? "Précédent" : "Previous"}
        </button>
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-primary" : "w-1.5 bg-muted"}`} />
          ))}
        </div>
        <button onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))} disabled={idx === slides.length - 1} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-30">
          {lang === "fr" ? "Suivant" : "Next"} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BigStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="num text-4xl font-bold text-primary">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
function StatRow({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="flex items-center justify-between border-b py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num font-semibold ${tone === "warn" ? "text-warning" : ""}`}>{value}</span>
    </div>
  );
}
function ImpactCard({ icon, value, label, accent }: { icon: React.ReactNode; value: string; label: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? "bg-primary/5 border-primary/30" : "bg-card"}`}>
      <div className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</div>
      <div className="num mt-3 text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
function RiskLine({ label, level }: { label: string; level: "LOW" | "MEDIUM" | "HIGH" }) {
  const color = level === "LOW" ? "bg-success" : level === "MEDIUM" ? "bg-warning" : "bg-destructive";
  const width = level === "LOW" ? "w-1/4" : level === "MEDIUM" ? "w-2/4" : "w-full";
  return (
    <div>
      <div className="flex items-center justify-between text-sm"><span>{label}</span><span className="text-[11px] font-bold tracking-wider">{level}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-muted"><div className={`h-1.5 rounded-full ${color} ${width}`} /></div>
    </div>
  );
}
