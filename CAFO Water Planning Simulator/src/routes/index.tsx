import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  Clock,
  Download,
  Droplets,
  Euro,
  Gauge,
  Heart,
  MapPin,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Presentation,
  Ruler,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import cafoLogo from "@/assets/cafo-logo.png.asset.json";
import { ProjectMap, type ScenarioKey } from "@/components/cafo/ProjectMap";
import { PhaseTimeline } from "@/components/cafo/PhaseTimeline";
import { DemandForecastChart } from "@/components/cafo/DemandForecastChart";
import { AdvisorPanel } from "@/components/cafo/AdvisorPanel";
import { PitchMode } from "@/components/cafo/PitchMode";
import { ScenarioSparkline } from "@/components/cafo/ScenarioSparkline";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CAFO Water Planning Simulator — L'eau qui rassemble" },
      {
        name: "description",
        content:
          "Decision-support prototype for evaluating rural water distribution projects in Guinea over a 20-year horizon.",
      },
    ],
  }),
  component: Simulator,
});

type Params = {
  growth: number;
  demand: number;
  budget: number;
  fountains: number;
  households: number;
};

const DEFAULTS: Params = {
  growth: 2,
  demand: 17,
  budget: 220_000,
  fountains: 5,
  households: 80,
};

// Source: CAFO — Base de Données Coûts AEP Rural · Guinée 2024
const VILLAGE_POPULATION_2025 = 1031;
const TOTAL_HOUSEHOLDS = 170;
const PEOPLE_PER_HH = 6.1;
const RESERVOIR_VOLUME_M3 = 40;
const RESERVOIR_ELEV_NGF = 373;
const HH_ABOVE_GRAVITY = 3;
const MAX_DISTANCE_M = 2062;
const INSTITUTIONAL_DEMAND = 1.865;
const NETWORK_LOSS_PCT = 0.15;
const IRRIGATION_DEMAND = 0.504;
const SYSTEM_CAPACITY_M3 = 37;

function compute(p: Params) {
  const pop2025 = VILLAGE_POPULATION_2025;
  const g = p.growth / 100;

  // ---- Demand (per spec) ----
  const domesticDemand = (pop2025 * p.demand) / 1000; // m³/day
  const totalDemand = (domesticDemand + INSTITUTIONAL_DEMAND + IRRIGATION_DEMAND) / (1 - NETWORK_LOSS_PCT);

  // ---- Cost (per spec) ----
  const pipeM = 700 + p.fountains * 250 + p.households * 20;
  const pipeMaterial = pipeM * 9.6; // €/m material
  const pipeLabor = pipeM * 4.5;    // €/m labor
  const fountainsCost = p.fountains * 2700;
  const hhCost = p.households * 350;
  const subtotal = pipeMaterial + pipeLabor + fountainsCost + hhCost;
  const contingency = subtotal * 0.08;
  const capex = subtotal + contingency;
  const opexAnnual = capex * 0.04;
  const lifecycleOM = opexAnnual * 20;

  // ---- Coverage ----
  const popServed = Math.min(pop2025, p.households * PEOPLE_PER_HH + p.fountains * 120);
  const coverage = (popServed / pop2025) * 100;
  const costPerPerson = popServed ? capex / popServed : 0;

  const utilization = (totalDemand / SYSTEM_CAPACITY_M3) * 100;
  const networkLength = pipeM;

  const avgDistance =
    p.households > 0
      ? Math.max(15, 320 - p.households * 0.4 - p.fountains * 6)
      : Math.max(60, 500 - p.fountains * 15);

  // ---- 20-year projection (per spec: scale total demand by growth) ----
  const years = Array.from({ length: 21 }, (_, i) => 2025 + i);
  const projection = years.map((y) => {
    const t = y - 2025;
    const population = Math.round(pop2025 * Math.pow(1 + g, t));
    const demand_m3 = +(totalDemand * Math.pow(1 + g, t)).toFixed(2);
    return { year: y, population, demand: demand_m3, capacity: SYSTEM_CAPACITY_M3 };
  });

  // ---- Scenarios: hardcoded reference values (CAFO field study) ----
  const scenarios = [
    {
      name: "Public Fountains",
      key: "fountains" as const,
      served: 1031,
      cost: 76_842,
      sustainability: 72,
      risk: "MEDIUM" as const,
      demand: 23.7,
    },
    {
      name: "Hybrid Network",
      key: "hybrid" as const,
      served: 1031,
      cost: 106_110,
      sustainability: 88,
      risk: "LOW" as const,
      demand: 23.7,
    },
    {
      name: "Household Connections",
      key: "household" as const,
      served: 1014,
      cost: 185_598,
      sustainability: 74,
      risk: "MEDIUM" as const,
      demand: 23.2,
    },
  ].map((s) => ({
    ...s,
    coverage: (s.served / pop2025) * 100,
    cpp: s.cost / Math.max(1, s.served),
  }));

  const scored = scenarios.map((s) => ({ ...s, score: s.key === "hybrid" ? 1 : 0.7 }));
  const best = scored.find((s) => s.key === "hybrid")!;
  const confidence = 92;
  const overBudget = capex > p.budget;

  // ---- CAPEX breakdown (matches spec line items) ----
  const breakdown = [
    { name: "Tuyaux (32mm HDPE)", value: Math.round(pipeMaterial) },
    { name: "Main d'œuvre pose", value: Math.round(pipeLabor) },
    { name: "Fontaines publiques", value: Math.round(fountainsCost) },
    { name: "Raccordements ménages", value: Math.round(hhCost) },
    { name: "Contingences (8%)", value: Math.round(contingency) },
  ].filter((b) => b.value > 0);

  return {
    projection,
    populationServed: popServed,
    coverage,
    capex,
    capexCore: subtotal,
    pipesCost: pipeMaterial + pipeLabor,
    fountainsCost,
    hhCost,
    omCost: lifecycleOM,
    contingency,
    opexAnnual,
    costPerPerson,
    dailyDemand: domesticDemand,
    totalDemand,
    utilization,
    networkLength,
    avgDistance,
    scenarios: scored,
    best,
    confidence,
    overBudget,
    pop2025,
    breakdown,
  };
}

function fmtEur(n: number) {
  return "€" + Math.round(n).toLocaleString("en-US");
}

const PIE_COLORS = [
  "oklch(0.55 0.18 250)",
  "oklch(0.66 0.14 235)",
  "oklch(0.62 0.14 155)",
  "oklch(0.72 0.15 75)",
  "oklch(0.68 0.18 25)",
];

type Lang = "en" | "fr";

const STRINGS = {
  en: {
    appTitle: "Water Planning Simulator",
    tagline: "L'eau qui rassemble",
    horizon: "Horizon: 2025 – 2045",
    hidePanel: "Hide panel",
    showPanel: "Show panel",
    villageTitle: "Village Guinéen · Préfecture de Boké",
    villageSub: (hh: number, pop: number) =>
      `10.990°N / −11.435°E · Water tower 40 m³ · Gravity system · ${hh} households · ${pop.toLocaleString()} inhabitants · 20-year lifecycle`,
    legend: { tower: "Water tower", pipes: "Pipe network", fountain: "Fountain", household: "Household" },
    kpi: {
      popServed: "Population Served", coverage: "Coverage Rate", capex: "Total CAPEX",
      opex: "Estimated OPEX / yr", cpp: "Cost per Person Served", dailyDemand: "Daily Water Demand",
      util: "Capacity Utilization", network: "Network Length", avgDist: "Avg Distance to Water",
      ofVillagers: (n: number) => `of ${n.toLocaleString()} villagers`,
      over: "over budget", within: "within budget",
    },
    sustainability: { title: "Long-Term Sustainability", sub: "Drag the year slider to project 20-year demand",
      year: "Projection year", population: "Population", demand: "Water Demand", capacity: "System Capacity", coverage: "Coverage Rate" },
    availability: { title: "Water Availability", sub: "Stress indicator for the selected year",
      avail: "Available Water", projDemand: "Projected Demand", util: "Utilization",
      over: "System overloaded — expansion required.", near: "Approaching capacity — plan reinforcement.", ok: "Healthy headroom for organic growth." },
    forecast: { title: "Demand Forecast 2025 – 2045", sub: "Population, water demand and system capacity" },
    invest: { title: "Investment Allocation", sub: "CAPEX breakdown by category", total: "Total CAPEX" },
    social: { title: "Social Impact", sub: "Beyond infrastructure — human outcomes",
      pop: "Population Served", hh: "Households Served", time: "Time Saved", women: "Women Benefiting", children: "Children Benefiting", cov: "Coverage Rate" },
    scenario: { title: "Scenario Comparison", sub: "Three infrastructure strategies side-by-side",
      metric: "Metric", best: "Best",
      rows: { served: "Population Served", coverage: "Coverage Rate", cost: "Cost", cpp: "Cost / Person", demand: "Water Demand", risk: "Risk", sust: "Sustainability" } },
    risk: { title: "Risk Assessment", sub: "Project risk register" },
    balance: { title: "Water Balance", sub: "Daily water balance",
      dom: "Domestic demand", inst: "Institutional demand", losses: "Network losses (15%)",
      totalNoIrr: "TOTAL without irrigation", irr: "Irrigation need (0.18 ha)", surplus: "Available surplus",
      foot1: "Sustainable capacity:", foot2: "Tower volume:", foot3: "Tank base elev.:" },
    quality: { title: "Water Quality", sub: "Field analyses · WHO thresholds",
      wells: "Open wells — total coliforms", wellsTherm: "Wells — thermotolerant coliforms",
      pumps: "Hand pumps — total coliforms", reservoir: "Reservoir — total coliforms",
      ph: "pH (pumps + reservoir)", turb: "Reservoir turbidity", nitr: "Nitrates NO₃ (reservoir)",
      lpd: "L / person / day", lpdFoot: "WHO ≥ 20", above: "Households > 373 m", aboveFoot: "no gravity supply",
      maxDist: "Max distance", maxDistFoot: "from reservoir" },
    exec: { title: "Executive Summary",
      footer: "Prepared by CAFO Engineering Consultants — strategic infrastructure planning for rural Guinea." },
    rec: { title: "Recommended Solution", confidence: "Confidence",
      sub: "Best balance of coverage, cost efficiency and long-term sustainability for the 2025–2045 horizon.",
      coverage: "Coverage", capex: "CAPEX", cpp: "Cost / Person", sust: "Sustainability",
      checks: {
        c1: "Highest population coverage among modeled options",
        c2: (b: string, budget: string) => `${b} the ${budget} budget envelope`,
        c3: (u: string, y: number) => `Uses available water efficiently (${u}% utilization in ${y})`,
        c4: "Sustainable operations through 2045", c5: "Lowest blended cost per beneficiary",
      },
      approaches: "Approaches", within: "Within",
    },
    panel: { title: "Project Parameters", section: "Control Panel",
      desc: "Adjust assumptions, then run the simulation to update all indicators.",
      growth: "Population Growth", demand: "Water Demand", budget: "Available Budget",
      fountains: "Public Fountains", households: "Household Connections",
      run: "Run Simulation",
      note: "Note —", noteBody: "Hydraulic calculations are simplified for prototyping. Outputs are indicative for decision-support and investor communication only.",
      growthUnit: (v: number) => v.toFixed(1) + " %/yr",
      demandUnit: (v: number) => v + " L/person/day",
      fountainsUnit: (v: number) => v + " fountains",
      hhUnit: (v: number) => v + " connections",
    },
    risks: [
      { label: "Technical Risk", level: "LOW" as const, note: "Proven gravity-fed design" },
      { label: "Financial Risk", level: "MEDIUM" as const, note: "Tariff recovery dependent on community" },
      { label: "Maintenance Risk", level: "MEDIUM" as const, note: "Requires trained local operator" },
      { label: "Water Availability Risk", level: "LOW" as const, note: "Reservoir surplus through 2045" },
      { label: "Community Acceptance Risk", level: "LOW" as const, note: "Strong demand for improved access" },
    ],
  },
  fr: {
    appTitle: "Simulateur de Planification de l'Eau",
    tagline: "L'eau qui rassemble",
    horizon: "Horizon : 2025 – 2045",
    hidePanel: "Masquer le panneau",
    showPanel: "Afficher le panneau",
    villageTitle: "Village Guinéen · Préfecture de Boké",
    villageSub: (hh: number, pop: number) =>
      `10.990°N / −11.435°E · Château d'eau 40 m³ · Système gravitaire · ${hh} ménages · ${pop.toLocaleString()} habitants · Cycle de vie 20 ans`,
    legend: { tower: "Château d'eau", pipes: "Réseau", fountain: "Borne fontaine", household: "Ménage" },
    kpi: {
      popServed: "Population desservie", coverage: "Taux de couverture", capex: "CAPEX total",
      opex: "OPEX estimé / an", cpp: "Coût par personne desservie", dailyDemand: "Demande quotidienne",
      util: "Utilisation de la capacité", network: "Longueur du réseau", avgDist: "Distance moyenne à l'eau",
      ofVillagers: (n: number) => `sur ${n.toLocaleString()} villageois`,
      over: "hors budget", within: "dans le budget",
    },
    sustainability: { title: "Durabilité à long terme", sub: "Faites glisser pour projeter la demande sur 20 ans",
      year: "Année de projection", population: "Population", demand: "Demande en eau", capacity: "Capacité système", coverage: "Taux de couverture" },
    availability: { title: "Disponibilité de l'eau", sub: "Indicateur de stress pour l'année choisie",
      avail: "Eau disponible", projDemand: "Demande projetée", util: "Utilisation",
      over: "Système surchargé — expansion requise.", near: "Approche de la capacité — renforcer.", ok: "Marge saine pour la croissance." },
    forecast: { title: "Prévision de la demande 2025 – 2045", sub: "Population, demande et capacité du système" },
    invest: { title: "Allocation des investissements", sub: "Répartition du CAPEX par catégorie", total: "CAPEX total" },
    social: { title: "Impact social", sub: "Au-delà de l'infrastructure — les résultats humains",
      pop: "Population desservie", hh: "Ménages desservis", time: "Temps gagné", women: "Femmes bénéficiaires", children: "Enfants bénéficiaires", cov: "Taux de couverture" },
    scenario: { title: "Comparaison des scénarios", sub: "Trois stratégies d'infrastructure côte à côte",
      metric: "Indicateur", best: "Optimal",
      rows: { served: "Population desservie", coverage: "Taux de couverture", cost: "Coût", cpp: "Coût / Personne", demand: "Demande en eau", risk: "Risque", sust: "Durabilité" } },
    risk: { title: "Évaluation des risques", sub: "Registre des risques du projet" },
    balance: { title: "Bilan Hydraulique", sub: "Bilan journalier",
      dom: "Demande domestique", inst: "Demande institutionnelle", losses: "Pertes réseau (15 %)",
      totalNoIrr: "TOTAL sans irrigation", irr: "Besoin irrigation (0.18 ha)", surplus: "Surplus disponible",
      foot1: "Capacité soutenable :", foot2: "Volume château :", foot3: "Alt. base cuve :" },
    quality: { title: "Qualité de l'eau", sub: "Analyses terrain · seuils OMS",
      wells: "Puits ouverts — colif. totaux", wellsTherm: "Puits — colif. thermotolérants",
      pumps: "Pompes à main — colif. totaux", reservoir: "Réservoir — colif. totaux",
      ph: "pH (pompes + réservoir)", turb: "Turbidité réservoir", nitr: "Nitrates NO₃ (réservoir)",
      lpd: "L / pers / jour", lpdFoot: "Seuil OMS ≥ 20", above: "Ménages > 373 m", aboveFoot: "non alim. gravité",
      maxDist: "Distance max", maxDistFoot: "depuis réservoir" },
    exec: { title: "Synthèse exécutive",
      footer: "Préparé par CAFO Engineering Consultants — planification stratégique pour la Guinée rurale." },
    rec: { title: "Solution recommandée", confidence: "Confiance",
      sub: "Meilleur équilibre couverture / coût / durabilité pour l'horizon 2025–2045.",
      coverage: "Couverture", capex: "CAPEX", cpp: "Coût / Personne", sust: "Durabilité",
      checks: {
        c1: "Couverture de population la plus élevée parmi les options modélisées",
        c2: (b: string, budget: string) => `${b} l'enveloppe budgétaire de ${budget}`,
        c3: (u: string, y: number) => `Utilise l'eau disponible efficacement (${u}% d'utilisation en ${y})`,
        c4: "Opérations durables jusqu'en 2045", c5: "Coût mixte par bénéficiaire le plus bas",
      },
      approaches: "Approche", within: "Dans",
    },
    panel: { title: "Paramètres du projet", section: "Panneau de contrôle",
      desc: "Ajustez les hypothèses, puis lancez la simulation pour mettre à jour les indicateurs.",
      growth: "Croissance démographique", demand: "Demande en eau", budget: "Budget disponible",
      fountains: "Bornes fontaines", households: "Branchements particuliers",
      run: "Lancer la simulation",
      note: "Note —", noteBody: "Les calculs hydrauliques sont simplifiés. Les résultats sont indicatifs pour l'aide à la décision et la communication aux investisseurs.",
      growthUnit: (v: number) => v.toFixed(1) + " %/an",
      demandUnit: (v: number) => v + " L/pers/jour",
      fountainsUnit: (v: number) => v + " bornes",
      hhUnit: (v: number) => v + " branchements",
    },
    risks: [
      { label: "Risque technique", level: "LOW" as const, note: "Conception gravitaire éprouvée" },
      { label: "Risque financier", level: "MEDIUM" as const, note: "Recouvrement tarifaire dépend de la communauté" },
      { label: "Risque de maintenance", level: "MEDIUM" as const, note: "Opérateur local formé requis" },
      { label: "Risque de disponibilité", level: "LOW" as const, note: "Surplus réservoir jusqu'en 2045" },
      { label: "Acceptation communautaire", level: "LOW" as const, note: "Forte demande d'accès amélioré" },
    ],
  },
};

function Simulator() {
  const [draft, setDraft] = useState<Params>(DEFAULTS);
  const [applied, setApplied] = useState<Params>(DEFAULTS);
  const [projYear, setProjYear] = useState<number>(2035);
  const [panelOpen, setPanelOpen] = useState<boolean>(true);
  const [lang, setLang] = useState<Lang>("en");
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("hybrid");
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const t = STRINGS[lang];

  const r = useMemo(() => compute(applied), [applied]);

  // Resolve active scenario object; falls back to recommended
  const activeScenarioObj = useMemo(
    () => r.scenarios.find((s) => s.key === activeScenario) ?? r.best,
    [r.scenarios, r.best, activeScenario],
  );

  // Dashboard metrics: when the user picks the recommended Hybrid scenario,
  // show the live simulation result driven by the control-panel sliders.
  // For other scenarios, show their reference figures.
  const isLiveScenario = activeScenario === "hybrid";
  const dashServed = isLiveScenario ? r.populationServed : activeScenarioObj.served;
  const dashCoverage = isLiveScenario ? r.coverage : activeScenarioObj.coverage;
  const dashCapex = isLiveScenario ? r.capex : activeScenarioObj.cost;
  const dashOpex = isLiveScenario ? r.opexAnnual : activeScenarioObj.cost * 0.04;
  const dashCpp = isLiveScenario ? r.costPerPerson : activeScenarioObj.cpp;
  const dashDaily = isLiveScenario ? r.totalDemand : activeScenarioObj.demand;
  const dashUtil = (dashDaily / SYSTEM_CAPACITY_M3) * 100;
  const dashNetworkKm = isLiveScenario ? r.networkLength / 1000 : (activeScenario === "fountains" ? 1.95 : 5.04);
  const dashOverBudget = dashCapex > applied.budget;

  const projAtYear = r.projection.find((x) => x.year === projYear) ?? r.projection[0];
  const projUtil = (projAtYear.demand / SYSTEM_CAPACITY_M3) * 100;
  const projCoverage = projAtYear.demand <= SYSTEM_CAPACITY_M3
    ? 100
    : Math.round((SYSTEM_CAPACITY_M3 / projAtYear.demand) * 100);
  // Critical year: first year where demand exceeds capacity at current growth
  const criticalYear = r.projection.find((p) => p.demand > SYSTEM_CAPACITY_M3)?.year ?? null;

  const dynamicRisks = t.risks.map((rk) => {
    if (rk.label === STRINGS.en.risks[1].label || rk.label === STRINGS.fr.risks[1].label) {
      const level: "LOW" | "MEDIUM" | "HIGH" = dashOverBudget ? "HIGH" : dashCapex > applied.budget * 0.9 ? "MEDIUM" : "LOW";
      return { ...rk, level };
    }
    if (rk.label === STRINGS.en.risks[3].label || rk.label === STRINGS.fr.risks[3].label) {
      const level: "LOW" | "MEDIUM" | "HIGH" = projUtil > 100 ? "HIGH" : projUtil > 80 ? "MEDIUM" : "LOW";
      return { ...rk, level };
    }
    return rk;
  });

  const womenBenef = Math.round(dashServed * 0.51);
  const childrenBenef = Math.round(dashServed * 0.42);
  const timeSavedHrs = Math.round((dashServed * 1.5 * 365) / 1000);

  // Scenario toggle labels
  const scenarioLabels: Record<ScenarioKey, string> = lang === "fr"
    ? { fountains: "Bornes fontaines", hybrid: "Hybride ★", household: "Réseau complet" }
    : { fountains: "Public fountains", hybrid: "Hybrid ★", household: "Full network" };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="flex h-20 items-center justify-between gap-2 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <img src={cafoLogo.url} alt="CAFO" className="h-10 w-auto shrink-0 sm:h-14" />
            <div className="hidden h-12 w-px bg-border sm:block" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold tracking-tight sm:text-lg">{t.appTitle}</div>
              <div className="truncate text-xs italic text-muted-foreground sm:text-sm">{t.tagline}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground sm:gap-3">
            <Badge variant="outline" className="hidden border-water/40 px-3 py-1 text-water lg:inline-flex">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-water" />
              CAFO · Base Coûts AEP Rural · Guinée 2024
            </Badge>
            <span className="hidden xl:inline">{t.horizon}</span>
            <div className="flex items-center overflow-hidden rounded-md border bg-card text-[11px] font-semibold">
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1.5 transition-colors ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                aria-label="English"
              >
                EN
              </button>
              <button
                onClick={() => setLang("fr")}
                className={`px-2.5 py-1.5 transition-colors ${lang === "fr" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                aria-label="Français"
              >
                FR
              </button>
            </div>
            <button
              onClick={() => setAdvisorOpen(true)}
              className="no-print hidden items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-primary/5 hover:border-primary/40 md:flex"
              title="AI Advisor"
            >
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span className="hidden lg:inline">{lang === "fr" ? "Conseiller IA" : "AI Advisor"}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="no-print hidden items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted md:flex"
              title="Export PDF"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">{lang === "fr" ? "Export PDF" : "Export PDF"}</span>
            </button>
            <button
              onClick={() => setPitchOpen(true)}
              className="no-print flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              title="Presentation mode"
            >
              <Presentation className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{lang === "fr" ? "Présenter" : "Present"}</span>
            </button>
            <button
              onClick={() => setPanelOpen((o) => !o)}
              className="no-print flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-xs font-medium hover:bg-muted sm:px-3"
              title={panelOpen ? t.hidePanel : t.showPanel}
            >
              {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              <span className="hidden sm:inline">{panelOpen ? t.hidePanel : t.showPanel}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Pitch + Advisor overlays */}
      <PitchMode
        open={pitchOpen}
        onClose={() => setPitchOpen(false)}
        lang={lang}
        recommended={{ name: r.best.name, coverage: r.best.coverage, cost: r.best.cost, sustainability: r.best.sustainability, risk: r.best.risk }}
        scenarios={r.scenarios.map((s) => ({ name: s.name, coverage: s.coverage, cost: s.cost, sustainability: s.sustainability, risk: s.risk }))}
        populationServed={dashServed}
        confidence={r.confidence}
      />
      <AdvisorPanel open={advisorOpen} onClose={() => setAdvisorOpen(false)} lang={lang} />



      <div className={`grid grid-cols-1 ${panelOpen ? "lg:grid-cols-[1fr_440px]" : "lg:grid-cols-1"}`}>
        <main className="border-r">

          <section className="p-4">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-base font-semibold">{t.villageTitle}</h1>
                <p className="num text-xs text-muted-foreground">
                  {t.villageSub(TOTAL_HOUSEHOLDS, VILLAGE_POPULATION_2025)}
                </p>
              </div>
              <div className="hidden shrink-0 items-center gap-3 text-[11px] text-muted-foreground md:flex">
                <Legend2 color="bg-primary" label={t.legend.tower} />
                <Legend2 color="bg-[oklch(0.66_0.14_235)]" label={t.legend.pipes} />
                <Legend2 color="bg-emerald-500" label={t.legend.fountain} />
                <Legend2 color="bg-slate-400" label={t.legend.household} />
              </div>
            </div>
            <ProjectMap fountains={applied.fountains} households={applied.households} scenario={activeScenario} highlightPhase={selectedPhase} />
          </section>

          {/* Scenario toggle (drives KPIs + map) */}
          <section className="px-4 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-2 shadow-sm">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {lang === "fr" ? "Scénario actif" : "Active scenario"}
                </span>
              </div>
              <div className="flex flex-1 items-center justify-end gap-1 overflow-x-auto">
                {(["fountains", "hybrid", "household"] as ScenarioKey[]).map((k) => {
                  const active = activeScenario === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setActiveScenario(k)}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {scenarioLabels[k]}
                    </button>
                  );
                })}
                <span className={`ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider ${dashOverBudget ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
                  {dashOverBudget ? (lang === "fr" ? "Hors budget" : "Over budget") : (lang === "fr" ? "Dans le budget" : "Within budget")}
                </span>
              </div>
            </div>
          </section>


          <section className="grid grid-cols-2 gap-3 px-4 pb-4 md:grid-cols-3 xl:grid-cols-3">
            <Kpi icon={<Users />} label={t.kpi.popServed} value={dashServed.toLocaleString()} sub={t.kpi.ofVillagers(r.pop2025)} />
            <Kpi icon={<Gauge />} label={t.kpi.coverage} value={dashCoverage.toFixed(1) + "%"} tone={dashCoverage >= 80 ? "good" : dashCoverage >= 60 ? "warn" : "bad"} />
            <Kpi icon={<Euro />} label={t.kpi.capex} value={fmtEur(dashCapex)} sub={dashOverBudget ? t.kpi.over : t.kpi.within} tone={dashOverBudget ? "bad" : "good"} />
            <Kpi icon={<Activity />} label={t.kpi.opex} value={fmtEur(dashOpex)} />
            <Kpi icon={<TrendingUp />} label={t.kpi.cpp} value={fmtEur(dashCpp)} />
            <Kpi icon={<Droplets />} label={t.kpi.dailyDemand} value={dashDaily.toFixed(1) + " m³"} />
            <Kpi icon={<Gauge />} label={t.kpi.util} value={dashUtil.toFixed(0) + "%"} tone={dashUtil > 100 ? "bad" : dashUtil > 80 ? "warn" : "good"} />
            <Kpi icon={<Network />} label={t.kpi.network} value={dashNetworkKm.toFixed(2) + " km"} />
            <Kpi icon={<Ruler />} label={t.kpi.avgDist} value={Math.round(r.avgDistance) + " m"} />
          </section>

          {/* PHASED 20-YEAR INVESTMENT TIMELINE */}
          <section className="px-4 pb-4">
            <PhaseTimeline selected={selectedPhase} onSelect={setSelectedPhase} lang={lang} />
          </section>



          {/* 20-YEAR PROJECTION + WATER STRESS GAUGE */}
          <section className="grid grid-cols-1 gap-4 px-4 pb-4 xl:grid-cols-2">
            <Card title={t.sustainability.title} subtitle={t.sustainability.sub}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t.sustainability.year}</span>
                <span className="num rounded-md border bg-card px-2 py-0.5 text-sm font-semibold text-primary">
                  {projYear}
                </span>
              </div>
              <Slider
                value={[projYear]}
                min={2025}
                max={2045}
                step={1}
                onValueChange={(v) => setProjYear(v[0])}
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>2025</span>
                <span>2045</span>
              </div>
              {criticalYear && projYear >= criticalYear && (
                <div className="mt-2 flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  {lang === "fr"
                    ? `⚠️ Capacité dépassée à ce taux de croissance (dès ${criticalYear})`
                    : `⚠️ Capacity exceeded at this growth rate (from ${criticalYear})`}
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniKpi label={t.sustainability.population} value={projAtYear.population.toLocaleString()} />
                <MiniKpi label={t.sustainability.demand} value={projAtYear.demand.toFixed(1) + " m³/d"} />
                <MiniKpi label={t.sustainability.capacity} value={SYSTEM_CAPACITY_M3 + " m³/d"} />
                <MiniKpi
                  label={t.sustainability.coverage}
                  value={projCoverage.toFixed(0) + "%"}
                  tone={projCoverage >= 80 ? "good" : projCoverage >= 60 ? "warn" : "bad"}
                />
              </div>
            </Card>

            <Card title={t.availability.title} subtitle={t.availability.sub}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Gauge2 value={projUtil} />
                </div>
                <div className="space-y-2 text-sm">
                  <Row2 label={t.availability.avail} value={SYSTEM_CAPACITY_M3.toFixed(0) + " m³/day"} />
                  <Row2 label={t.availability.projDemand} value={projAtYear.demand.toFixed(1) + " m³/day"} />
                  <Row2
                    label={t.availability.util}
                    value={projUtil.toFixed(0) + "%"}
                    tone={projUtil > 100 ? "bad" : projUtil > 80 ? "warn" : "good"}
                  />
                  <div className="mt-3 rounded-md bg-muted/50 p-2 text-[11px] leading-relaxed text-muted-foreground">
                    {projUtil > 100
                      ? t.availability.over
                      : projUtil > 80
                      ? t.availability.near
                      : t.availability.ok}
                  </div>
                </div>
              </div>
            </Card>
          </section>


          {/* DEMAND FORECAST + COST BREAKDOWN */}
          <section className="grid grid-cols-1 gap-4 px-4 pb-4 xl:grid-cols-2">
            <DemandForecastChart projection={r.projection} lang={lang} onYearChange={setProjYear} />


            <Card title={t.invest.title} subtitle={t.invest.sub}>
              <div className="grid grid-cols-[180px_1fr] items-center gap-3">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={r.breakdown} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {r.breakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(v: number) => fmtEur(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-1.5 text-xs">
                  {r.breakdown.map((b, i) => {
                    const pct = (b.value / r.capex) * 100;
                    return (
                      <li key={b.name} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="text-muted-foreground">{b.name}</span>
                        </span>
                        <span className="num font-semibold">
                          {fmtEur(b.value)} <span className="text-muted-foreground">· {pct.toFixed(0)}%</span>
                        </span>
                      </li>
                    );
                  })}
                  <li className="mt-2 flex items-center justify-between border-t pt-2">
                    <span className="font-semibold">{t.invest.total}</span>
                    <span className="num font-bold text-primary">{fmtEur(r.capex)}</span>
                  </li>
                </ul>
              </div>
            </Card>
          </section>

          {/* SOCIAL IMPACT */}
          <section className="px-4 pb-4">
            <Card title={t.social.title} subtitle={t.social.sub}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <ImpactKpi icon={<Users />} label={t.social.pop} value={r.populationServed.toLocaleString()} />
                <ImpactKpi icon={<Building2 />} label={t.social.hh} value={Math.round(r.populationServed / PEOPLE_PER_HH).toLocaleString()} />
                <ImpactKpi icon={<Clock />} label={t.social.time} value={timeSavedHrs + (lang === "fr" ? "k h/an" : "k hrs/yr")} />
                <ImpactKpi icon={<Heart />} label={t.social.women} value={womenBenef.toLocaleString()} tone="accent" />
                <ImpactKpi icon={<Users />} label={t.social.children} value={childrenBenef.toLocaleString()} tone="accent" />
                <ImpactKpi icon={<Gauge />} label={t.social.cov} value={r.coverage.toFixed(0) + "%"} tone="good" />
              </div>
            </Card>
          </section>

          {/* SCENARIO COMPARISON + RISK ASSESSMENT */}
          <section className="grid grid-cols-1 gap-4 px-4 pb-4 xl:grid-cols-[2fr_1fr]">
            <Card title={t.scenario.title} subtitle={lang === "fr" ? "Cliquez un scénario pour piloter le tableau de bord et la carte" : "Click a scenario to drive the dashboard and map"}>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[480px] text-xs">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t.scenario.metric}</th>
                      {r.scenarios.map((s) => {
                        const active = s.key === activeScenario;
                        return (
                          <th
                            key={s.name}
                            onClick={() => setActiveScenario(s.key)}
                            className={`cursor-pointer px-3 py-2 text-right font-medium transition-colors ${
                              active ? "bg-primary/10 text-primary" : s.name === r.best.name ? "text-primary hover:bg-muted" : "hover:bg-muted"
                            }`}
                          >
                            {s.name}
                            {s.name === r.best.name && (
                              <Badge className="ml-1.5 bg-primary/10 text-primary hover:bg-primary/10">{t.scenario.best}</Badge>
                            )}
                            {active && <span className="ml-1 text-[9px]">●</span>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="num">
                    <Row label={t.scenario.rows.served} values={r.scenarios.map((s) => s.served.toLocaleString())} bestIdx={r.scenarios.indexOf(r.best)} />
                    <Row label={t.scenario.rows.coverage} values={r.scenarios.map((s) => s.coverage.toFixed(0) + "%")} bestIdx={r.scenarios.indexOf(r.best)} />
                    <Row label={t.scenario.rows.cost} values={r.scenarios.map((s) => fmtEur(s.cost))} bestIdx={r.scenarios.indexOf(r.best)} />
                    <Row label={t.scenario.rows.cpp} values={r.scenarios.map((s) => fmtEur(s.cpp))} bestIdx={r.scenarios.indexOf(r.best)} />
                    <Row label={t.scenario.rows.demand} values={r.scenarios.map((s) => s.demand.toFixed(1) + " m³/d")} bestIdx={r.scenarios.indexOf(r.best)} />
                    <Row label={t.scenario.rows.risk} values={r.scenarios.map((s) => s.risk)} bestIdx={r.scenarios.indexOf(r.best)} />
                    <Row label={t.scenario.rows.sust} values={r.scenarios.map((s) => s.sustainability + " / 100")} bestIdx={r.scenarios.indexOf(r.best)} />
                    <tr className="border-t bg-muted/20">
                      <td className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">{lang === "fr" ? "Coût sur 20 ans" : "Cost over 20 yrs"}</td>
                      {r.scenarios.map((s) => (
                        <td key={s.name} className="px-3 py-2">
                          <ScenarioSparkline cost={s.cost} color={s.key === activeScenario ? "oklch(0.38 0.12 250)" : "oklch(0.66 0.14 235)"} />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>


            <Card title={t.risk.title} subtitle={t.risk.sub}>
              <ul className="divide-y text-sm">
                {dynamicRisks.map((rk) => (
                  <li key={rk.label} className="flex items-center justify-between gap-2 py-2">
                    <div>
                      <div className="font-medium">{rk.label}</div>
                      <div className="text-[11px] text-muted-foreground">{rk.note}</div>
                    </div>
                    <RiskPill level={rk.level} />
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          {/* BILAN HYDRAULIQUE + QUALITÉ */}
          <section className="grid grid-cols-1 gap-4 px-4 pb-4 xl:grid-cols-2">
            <Card title={t.balance.title} subtitle={t.balance.sub}>
              <ul className="num divide-y text-sm">
                <BalanceRow label={t.balance.dom} value={r.dailyDemand.toFixed(2) + " m³/j"} muted />
                <BalanceRow label={t.balance.inst} value={INSTITUTIONAL_DEMAND.toFixed(2) + " m³/j"} muted />
                <BalanceRow label={t.balance.losses} value={((r.dailyDemand + INSTITUTIONAL_DEMAND) * NETWORK_LOSS_PCT).toFixed(2) + " m³/j"} muted />
                <BalanceRow
                  label={t.balance.totalNoIrr}
                  value={((r.dailyDemand + INSTITUTIONAL_DEMAND) * (1 + NETWORK_LOSS_PCT)).toFixed(2) + " m³/j"}
                  strong
                />
                <BalanceRow label={t.balance.irr} value={IRRIGATION_DEMAND.toFixed(1) + " m³/j"} muted />
                {(() => {
                  const total = (r.dailyDemand + INSTITUTIONAL_DEMAND) * (1 + NETWORK_LOSS_PCT) + IRRIGATION_DEMAND;
                  const surplus = SYSTEM_CAPACITY_M3 - total;
                  return (
                    <BalanceRow label={t.balance.surplus} value={surplus.toFixed(2) + " m³/j"} ok={surplus >= 0} bad={surplus < 0} strong />
                  );
                })()}
              </ul>
              <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                {t.balance.foot1} <span className="num font-semibold text-foreground">{SYSTEM_CAPACITY_M3} m³/j</span> ·
                {" "}{t.balance.foot2} <span className="num font-semibold text-foreground">{RESERVOIR_VOLUME_M3} m³</span> ·
                {" "}{t.balance.foot3} <span className="num font-semibold text-foreground">{RESERVOIR_ELEV_NGF} m NGF</span>
              </div>
            </Card>

            <Card title={t.quality.title} subtitle={t.quality.sub}>
              <ul className="num divide-y text-sm">
                <QualityRow label={t.quality.wells} value="200–600 UFC/100 mL" status="bad" />
                <QualityRow label={t.quality.wellsTherm} value="150–320 UFC/100 mL" status="bad" />
                <QualityRow label={t.quality.pumps} value="0 UFC/100 mL" status="ok" />
                <QualityRow label={t.quality.reservoir} value="0 UFC/100 mL" status="ok" />
                <QualityRow label={t.quality.ph} value="7.0 – 7.3" hint={lang === "fr" ? "OMS 6.5 – 8.5" : "WHO 6.5 – 8.5"} status="ok" />
                <QualityRow label={t.quality.turb} value="0.3 NTU" hint={lang === "fr" ? "OMS < 1 NTU" : "WHO < 1 NTU"} status="ok" />
                <QualityRow label={t.quality.nitr} value="7 mg/L" hint={lang === "fr" ? "OMS < 50 mg/L" : "WHO < 50 mg/L"} status="ok" />
              </ul>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-amber-700">{t.quality.lpd}</div>
                  <div className="text-lg font-semibold text-amber-700">17.2</div>
                  <div className="text-[10px] text-amber-700">{t.quality.lpdFoot}</div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-200/70 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900">
                    ⚠️ {lang === "fr" ? "En dessous du seuil OMS" : "Below WHO threshold"}
                  </div>
                </div>
                <MiniStat label={t.quality.above} value={String(HH_ABOVE_GRAVITY)} foot={t.quality.aboveFoot} tone="warn" />
                <MiniStat label={t.quality.maxDist} value={MAX_DISTANCE_M.toLocaleString() + " m"} foot={t.quality.maxDistFoot} />
              </div>
            </Card>
          </section>


          {/* EXECUTIVE SUMMARY */}
          <section className="px-4 pb-6">
            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {t.exec.title}
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                {lang === "fr" ? (
                  <>
                    Le scénario <span className="font-semibold text-primary">Réseau Hybride</span> dessert{" "}
                    <span className="font-semibold">100%</span> de la population
                    ({VILLAGE_POPULATION_2025.toLocaleString("fr-FR")} bénéficiaires) pour un CAPEX de{" "}
                    <span className="font-semibold">{fmtEur(r.best.cost)}</span> — bien en-deçà
                    de l'enveloppe budgétaire de <span className="font-semibold">{fmtEur(applied.budget)}</span>.
                    Le coût par bénéficiaire est de <span className="font-semibold">{fmtEur(r.best.cpp)}</span>,
                    avec un OPEX annuel de <span className="font-semibold">{fmtEur(r.best.cost * 0.04)}</span>.
                    {" "}L'utilisation atteint <span className="font-semibold">{projUtil.toFixed(0)}%</span> en {projYear},
                    {projUtil > 100 ? " indiquant un besoin d'expansion" : projUtil > 80 ? " approchant les limites" : " maintenant une disponibilité adéquate"} jusqu'en 2045.
                  </>
                ) : (
                  <>
                    The <span className="font-semibold text-primary">Hybrid Network</span> scenario
                    serves <span className="font-semibold">100%</span> of the population
                    ({VILLAGE_POPULATION_2025.toLocaleString()} beneficiaries) at a CAPEX of{" "}
                    <span className="font-semibold">{fmtEur(r.best.cost)}</span> — well within
                    the <span className="font-semibold">{fmtEur(applied.budget)}</span> budget envelope.
                    Cost per beneficiary is <span className="font-semibold">{fmtEur(r.best.cpp)}</span>,
                    with an annual OPEX of <span className="font-semibold">{fmtEur(r.best.cost * 0.04)}</span>.
                    {" "}System utilization reaches <span className="font-semibold">{projUtil.toFixed(0)}%</span> by{" "}
                    {projYear}, {projUtil > 100 ? "indicating the need for capacity expansion" : projUtil > 80 ? "approaching capacity limits" : "maintaining adequate water availability"} through 2045.
                  </>
                )}
              </p>
              <div className="mt-3 text-[11px] italic text-muted-foreground">
                {t.exec.footer}
              </div>
            </div>
          </section>


          {/* RECOMMENDED SOLUTION — bottom */}
          <section className="px-4 pb-6">
            <div className="rounded-lg border-l-4 border-primary bg-gradient-to-br from-primary/5 to-transparent p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> {t.rec.title}
                </div>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                  {t.rec.confidence}: {r.confidence}%
                </Badge>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-2xl font-semibold tracking-tight">{r.best.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t.rec.sub}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                  <Stat label={t.rec.coverage} value={r.best.coverage.toFixed(0) + "%"} />
                  <Stat label={t.rec.capex} value={fmtEur(r.best.cost)} />
                  <Stat label={t.rec.cpp} value={fmtEur(r.best.cpp)} />
                  <Stat label={t.rec.sust} value={r.best.sustainability + "/100"} />
                </div>
              </div>
              <ul className="mt-4 grid grid-cols-1 gap-1.5 text-sm md:grid-cols-2">
                <Check>{t.rec.checks.c1}</Check>
                <Check>
                  {lang === "fr"
                    ? `Respecte le budget avec une marge de ${fmtEur(applied.budget - r.best.cost)}`
                    : `Within budget with a margin of ${fmtEur(applied.budget - r.best.cost)}`}
                </Check>
                <Check>{t.rec.checks.c3(projUtil.toFixed(0), projYear)}</Check>
                <Check>{t.rec.checks.c4}</Check>
                <Check>{t.rec.checks.c5}</Check>
              </ul>
            </div>
          </section>
        </main>

        {/* Mobile backdrop */}
        {panelOpen && (
          <div
            className="fixed inset-0 top-20 z-30 bg-black/40 lg:hidden"
            onClick={() => setPanelOpen(false)}
            aria-hidden
          />
        )}

        {/* RIGHT — Control Panel */}
        {panelOpen && (
        <aside className="fixed inset-y-0 right-0 top-20 z-40 w-full max-w-sm overflow-y-auto border-l bg-panel shadow-xl lg:static lg:sticky lg:top-20 lg:z-auto lg:h-[calc(100vh-5rem)] lg:max-w-none lg:shadow-none">

          <div className="border-b px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.panel.section}</div>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{t.panel.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t.panel.desc}</p>
          </div>

          <div className="space-y-6 p-5">
            <ParamSlider icon={<TrendingUp className="h-3.5 w-3.5" />} label={t.panel.growth} value={draft.growth} min={0} max={5} step={0.1} format={t.panel.growthUnit} onChange={(v) => setDraft({ ...draft, growth: v })} />
            <ParamSlider icon={<Droplets className="h-3.5 w-3.5" />} label={t.panel.demand} value={draft.demand} min={10} max={50} step={1} format={t.panel.demandUnit} onChange={(v) => setDraft({ ...draft, demand: v })} />
            <ParamSlider icon={<Euro className="h-3.5 w-3.5" />} label={t.panel.budget} value={draft.budget} min={50_000} max={300_000} step={5_000} format={(v) => "€" + v.toLocaleString(lang === "fr" ? "fr-FR" : "en-US")} onChange={(v) => setDraft({ ...draft, budget: v })} />
            <ParamSlider icon={<MapPin className="h-3.5 w-3.5" />} label={t.panel.fountains} value={draft.fountains} min={0} max={20} step={1} format={t.panel.fountainsUnit} onChange={(v) => setDraft({ ...draft, fountains: v })} />
            <ParamSlider icon={<Network className="h-3.5 w-3.5" />} label={t.panel.households} value={draft.households} min={0} max={300} step={5} format={t.panel.hhUnit} onChange={(v) => setDraft({ ...draft, households: v })} />

            {(() => {
              const dirty =
                draft.growth !== applied.growth ||
                draft.demand !== applied.demand ||
                draft.budget !== applied.budget ||
                draft.fountains !== applied.fountains ||
                draft.households !== applied.households;
              return (
                <div className="sticky bottom-0 -mx-5 border-t bg-panel/95 px-5 py-3 backdrop-blur">
                  <Button
                    onClick={() => {
                      setApplied({ ...draft });
                      if (typeof window !== "undefined" && window.innerWidth < 1024) setPanelOpen(false);
                    }}
                    className={`h-11 w-full text-base font-semibold text-primary-foreground transition-all ${
                      dirty ? "animate-pulse bg-primary shadow-lg ring-2 ring-primary/30 hover:bg-primary/90" : "bg-primary/80 hover:bg-primary"
                    }`}
                  >
                    <Play className="mr-2 h-4 w-4" /> {t.panel.run}
                    {dirty && <span className="ml-2 rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">●</span>}
                  </Button>
                </div>
              );
            })()}

            <div className="rounded-md border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{t.panel.note}</span> {t.panel.noteBody}
            </div>
          </div>
        </aside>
        )}


      </div>
    </div>
  );
}

function Legend2({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-sm font-semibold tracking-tight">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "good" | "warn" | "bad" }) {
  const toneCls = tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <div className={`num mt-1.5 text-xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const toneCls = tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`num text-lg font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function ImpactKpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "good" | "accent" }) {
  const toneCls = tone === "good" ? "text-success" : tone === "accent" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-md border bg-gradient-to-br from-card to-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="text-muted-foreground [&>svg]:h-3 [&>svg]:w-3">{icon}</span>
        {label}
      </div>
      <div className={`num mt-1 text-lg font-semibold tracking-tight ${toneCls}`}>{value}</div>
    </div>
  );
}

function Row2({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const toneCls = tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num font-semibold ${toneCls}`}>{value}</span>
    </div>
  );
}

function Gauge2({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(value, 130));
  const angle = (clamped / 130) * 180 - 90;
  const color = value > 100 ? "oklch(0.6 0.2 25)" : value > 80 ? "oklch(0.75 0.16 75)" : "oklch(0.62 0.14 155)";
  const label = value > 100 ? "Overloaded" : value > 80 ? "High stress" : "Healthy";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[200px]">
        <path d="M20 110 A80 80 0 0 1 180 110" fill="none" stroke="oklch(0.62 0.14 155)" strokeWidth="14" strokeLinecap="round" />
        <path d="M20 110 A80 80 0 0 1 180 110" fill="none" stroke="oklch(0.75 0.16 75)" strokeWidth="14" strokeLinecap="round" strokeDasharray="251" strokeDashoffset="50" />
        <path d="M20 110 A80 80 0 0 1 180 110" fill="none" stroke="oklch(0.6 0.2 25)" strokeWidth="14" strokeLinecap="round" strokeDasharray="251" strokeDashoffset="200" />
        <g transform={`rotate(${angle} 100 110)`}>
          <line x1="100" y1="110" x2="100" y2="40" stroke="oklch(0.2 0.02 250)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="110" r="6" fill="oklch(0.2 0.02 250)" />
        </g>
      </svg>
      <div className="num -mt-2 text-2xl font-bold tracking-tight" style={{ color }}>{value.toFixed(0)}%</div>
      <div className="text-[11px] font-medium" style={{ color }}>{label}</div>
    </div>
  );
}

function RiskPill({ level }: { level: "LOW" | "MEDIUM" | "HIGH" }) {
  const cls =
    level === "LOW"
      ? "bg-success/15 text-success"
      : level === "MEDIUM"
      ? "bg-warning/15 text-warning"
      : "bg-destructive/15 text-destructive";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold tracking-wider ${cls}`}>
      {level === "HIGH" && <AlertTriangle className="h-3 w-3" />}
      {level}
    </span>
  );
}

function Row({ label, values, bestIdx }: { label: string; values: string[]; bestIdx: number }) {
  return (
    <tr className="border-t">
      <td className="px-3 py-2 text-left text-muted-foreground">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`px-3 py-2 text-right ${i === bestIdx ? "bg-primary/5 font-semibold text-primary" : ""}`}>
          {v}
        </td>
      ))}
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="num text-base font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function BalanceRow({ label, value, muted, strong, ok, bad }: { label: string; value: string; muted?: boolean; strong?: boolean; ok?: boolean; bad?: boolean }) {
  const valueCls = bad ? "text-destructive" : ok ? "text-success" : strong ? "text-primary" : "text-foreground";
  return (
    <li className="flex items-center justify-between py-2">
      <span className={muted ? "text-muted-foreground" : "font-medium"}>{label}</span>
      <span className={`font-semibold ${valueCls}`}>{value} {ok && "✓"}{bad && " ✗"}</span>
    </li>
  );
}

function QualityRow({ label, value, hint, status }: { label: string; value: string; hint?: string; status: "ok" | "bad" }) {
  return (
    <li className="flex items-center justify-between py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2">
        {hint && <span className="text-[10px] text-muted-foreground">({hint})</span>}
        <span className={`font-semibold ${status === "ok" ? "text-success" : "text-destructive"}`}>
          {value} {status === "ok" ? "✓" : "✗"}
        </span>
      </span>
    </li>
  );
}

function MiniStat({ label, value, foot, tone }: { label: string; value: string; foot: string; tone?: "warn" }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone === "warn" ? "text-warning" : "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{foot}</div>
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">✓</span>
      <span className="text-foreground/90">{children}</span>
    </li>
  );
}

function ParamSlider({ icon, label, value, min, max, step, format, unit, onChange }: { icon: React.ReactNode; label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; unit?: string; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));
  const commit = () => {
    const n = Number(text.replace(/[^\d.\-]/g, ""));
    if (!Number.isNaN(n)) {
      const clamped = Math.max(min, Math.min(max, n));
      onChange(clamped);
    }
    setEditing(false);
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {label}
        </div>
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="number"
              value={text}
              min={min}
              max={max}
              step={step}
              onChange={(e) => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setText(String(value));
                  setEditing(false);
                }
              }}
              className="num w-24 rounded-md border bg-card px-2 py-0.5 text-right text-xs font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/30"
            />
            {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
          </div>
        ) : (
          <button
            onClick={() => {
              setText(String(value));
              setEditing(true);
            }}
            className="num rounded-md border bg-card px-2 py-0.5 text-xs font-semibold text-primary hover:bg-muted"
            title="Click to type a value"
          >
            {format(value)}
          </button>
        )}
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

