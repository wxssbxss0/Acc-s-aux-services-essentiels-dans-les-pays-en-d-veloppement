import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Building2, Droplets, Layers, Maximize2, Minus, MapPin, Mountain, Network, Plus, Power, Users, X } from "lucide-react";

export type ScenarioKey = "fountains" | "hybrid" | "household";

type Props = {
  fountains: number;
  households: number;
  scenario?: ScenarioKey;
  highlightPhase?: number | null;
};

// ---------- Deterministic RNG ----------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ---------- Geographic constants (from CAFO 2024 dataset) ----------
const BOUNDS = {
  latMin: 10.9775,
  latMax: 11.0055,
  lonMin: -11.4485,
  lonMax: -11.4185,
};
const RESERVOIR = { lat: 10.995, lon: -11.4358, alt: 368 };
const RESERVOIR_ELEV_THRESH = 373;

type PtType = "household" | "household-irr" | "well" | "pump" | "school" | "reservoir";

type Point = {
  id: string;
  type: PtType;
  lat: number;
  lon: number;
  alt: number;
  hhSize?: number;
  demandL?: number;
  label?: string;
};

// ---------- Dataset generator (matches the uploaded carte_village.png) ----------
function buildDataset(): Point[] {
  const r = rng(20241227);
  const pts: Point[] = [];
  let nextId = 1;
  const mk = (p: Omit<Point, "id">) => pts.push({ ...p, id: `p${nextId++}` });

  // Three village clusters (matches screenshot)
  const clusters: { cLat: number; cLon: number; rLat: number; rLon: number; hh: number; irr: number; wells: number; pumps: number; schools: number }[] = [
    { cLat: 10.9913, cLon: -11.4438, rLat: 0.005, rLon: 0.005, hh: 55, irr: 2, wells: 9, pumps: 1, schools: 2 },
    { cLat: 10.9835, cLon: -11.4307, rLat: 0.0055, rLon: 0.005, hh: 72, irr: 6, wells: 11, pumps: 1, schools: 2 },
    { cLat: 11.0015, cLon: -11.4245, rLat: 0.004, rLon: 0.005, hh: 30, irr: 0, wells: 4, pumps: 1, schools: 1 },
  ];

  const altAt = (lat: number, lon: number) => {
    // Gentle slope: NW higher, SE lower; reservoir ~368
    const nx = (lon - BOUNDS.lonMin) / (BOUNDS.lonMax - BOUNDS.lonMin);
    const ny = (lat - BOUNDS.latMin) / (BOUNDS.latMax - BOUNDS.latMin);
    const base = 350 + (1 - nx) * 18 + ny * 8;
    return +(base + (r() - 0.5) * 6).toFixed(1);
  };

  for (const c of clusters) {
    for (let i = 0; i < c.hh; i++) {
      const lat = c.cLat + (r() - 0.5) * c.rLat;
      const lon = c.cLon + (r() - 0.5) * c.rLon;
      const hhSize = Math.max(2, Math.round(4 + r() * 7));
      mk({ type: "household", lat, lon, alt: altAt(lat, lon), hhSize, demandL: hhSize * 20 });
    }
    for (let i = 0; i < c.irr; i++) {
      const lat = c.cLat + (r() - 0.5) * c.rLat;
      const lon = c.cLon + (r() - 0.5) * c.rLon;
      const hhSize = Math.max(3, Math.round(5 + r() * 7));
      mk({ type: "household-irr", lat, lon, alt: altAt(lat, lon), hhSize, demandL: hhSize * 20 + 80 });
    }
    for (let i = 0; i < c.wells; i++) {
      const lat = c.cLat + (r() - 0.5) * c.rLat * 0.9;
      const lon = c.cLon + (r() - 0.5) * c.rLon * 0.9;
      mk({ type: "well", lat, lon, alt: altAt(lat, lon), label: `Puits ouvert #${i + 1}` });
    }
    for (let i = 0; i < c.pumps; i++) {
      const lat = c.cLat + (r() - 0.5) * c.rLat * 0.6;
      const lon = c.cLon + (r() - 0.5) * c.rLon * 0.6;
      mk({ type: "pump", lat, lon, alt: altAt(lat, lon), label: `Pompe à main` });
    }
    for (let i = 0; i < c.schools; i++) {
      const lat = c.cLat + (r() - 0.5) * c.rLat * 0.7;
      const lon = c.cLon + (r() - 0.5) * c.rLon * 0.7;
      mk({ type: "school", lat, lon, alt: altAt(lat, lon), label: i % 2 ? "École primaire" : "Commerce" });
    }
  }

  // 3 households above gravity threshold (south of village, alt > 373)
  const above = [
    { lat: 10.9788, lon: -11.4338 },
    { lat: 10.9792, lon: -11.4325 },
    { lat: 10.9783, lon: -11.4348 },
  ];
  for (const p of above) {
    mk({ type: "household", lat: p.lat, lon: p.lon, alt: 376 + r() * 2, hhSize: 6, demandL: 120 });
  }

  // Reservoir
  mk({ type: "reservoir", lat: RESERVOIR.lat, lon: RESERVOIR.lon, alt: RESERVOIR.alt, label: "Château d'eau · 40 m³" });

  return pts;
}

// ---------- Distance (Haversine, meters) ----------
function distM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- Layer config ----------
type LayerKey =
  | "households"
  | "tower"
  | "wells"
  | "pumps"
  | "schools"
  | "demand"
  | "altitude"
  | "contours"
  | "network"
  | "pressure";

const LAYER_META: { key: LayerKey; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "households", label: "Households", icon: <Users className="h-3 w-3" />, color: "bg-slate-500" },
  { key: "tower", label: "Water tower", icon: <Droplets className="h-3 w-3" />, color: "bg-primary" },
  { key: "wells", label: "Existing wells", icon: <MapPin className="h-3 w-3" />, color: "bg-orange-500" },
  { key: "pumps", label: "Hand pumps", icon: <Power className="h-3 w-3" />, color: "bg-emerald-600" },
  { key: "schools", label: "Schools & commerce", icon: <Building2 className="h-3 w-3" />, color: "bg-slate-800" },
  { key: "network", label: "Proposed network", icon: <Network className="h-3 w-3" />, color: "bg-[oklch(0.66_0.14_235)]" },
  { key: "pressure", label: "Pipe pressure zones", icon: <Network className="h-3 w-3" />, color: "bg-emerald-500" },
  { key: "contours", label: "Elevation contours", icon: <Mountain className="h-3 w-3" />, color: "bg-amber-700" },
  { key: "demand", label: "Water demand heatmap", icon: <Droplets className="h-3 w-3" />, color: "bg-rose-500" },
  { key: "altitude", label: "Altitude heatmap", icon: <Mountain className="h-3 w-3" />, color: "bg-amber-500" },
];

export function ProjectMap({ fountains, households, scenario = "hybrid", highlightPhase = null }: Props) {
  const data = useMemo(() => buildDataset(), []);
  const W = 1000;
  const H = 560;
  const PAD = 30;

  // lat/lon → SVG
  const project = (lat: number, lon: number) => {
    const nx = (lon - BOUNDS.lonMin) / (BOUNDS.lonMax - BOUNDS.lonMin);
    const ny = (lat - BOUNDS.latMin) / (BOUNDS.latMax - BOUNDS.latMin);
    return { x: PAD + nx * (W - 2 * PAD), y: H - PAD - ny * (H - 2 * PAD) };
  };

  const reservoir = data.find((p) => p.type === "reservoir")!;
  const reservoirXY = project(reservoir.lat, reservoir.lon);
  const householdsAll = data.filter((p) => p.type === "household" || p.type === "household-irr");
  const wells = data.filter((p) => p.type === "well");
  const pumps = data.filter((p) => p.type === "pump");
  const schools = data.filter((p) => p.type === "school");

  // Scenario-driven counts override the slider values for visualization purposes
  const effFountains = scenario === "fountains" ? 8 : scenario === "household" ? 0 : Math.max(fountains, 4);
  const effHouseholds = scenario === "fountains" ? 0 : scenario === "household" ? Math.max(households, 167) : Math.max(households, 90);

  // Connected households = first N by proximity to reservoir
  const sortedByDist = useMemo(
    () =>
      householdsAll
        .map((p) => ({ p, d: distM(p, reservoir) }))
        .sort((a, b) => a.d - b.d),
    [householdsAll, reservoir],
  );
  const connectedIds = new Set(sortedByDist.slice(0, effHouseholds).map((x) => x.p.id));

  // Phase highlighting: which HHs belong to selected phase
  // P1 = 0 hh (fountains only), P2 = first 50, P3 = 51..167, P4 = none new
  const phaseHHIds = useMemo(() => {
    if (highlightPhase == null) return null;
    const sorted = sortedByDist.map((x) => x.p.id);
    if (highlightPhase === 1) return new Set<string>();
    if (highlightPhase === 2) return new Set(sorted.slice(0, 50));
    if (highlightPhase === 3) return new Set(sorted.slice(50, 167));
    return new Set<string>();
  }, [highlightPhase, sortedByDist]);

  // Proposed fountains: place at cluster centroids, ranked by population
  const proposedFountains = useMemo(() => {
    const clusters: { cLat: number; cLon: number; pop: number }[] = [
      { cLat: 10.9913, cLon: -11.4438, pop: 360 },
      { cLat: 10.9835, cLon: -11.4307, pop: 470 },
      { cLat: 11.0015, cLon: -11.4245, pop: 200 },
      { cLat: 10.9885, cLon: -11.4360, pop: 120 },
      { cLat: 10.9975, cLon: -11.4310, pop: 100 },
      { cLat: 10.9870, cLon: -11.4260, pop: 90 },
      { cLat: 11.0035, cLon: -11.4220, pop: 80 },
      { cLat: 10.9950, cLon: -11.4400, pop: 70 },
      { cLat: 10.9820, cLon: -11.4400, pop: 60 },
      { cLat: 10.9810, cLon: -11.4275, pop: 55 },
      { cLat: 10.9990, cLon: -11.4275, pop: 50 },
      { cLat: 11.0000, cLon: -11.4380, pop: 45 },
    ];
    return clusters.sort((a, b) => b.pop - a.pop).slice(0, effFountains);
  }, [effFountains]);

  // Pressure zone for a given altitude vs reservoir
  const pressureColor = (alt: number) => {
    const head = RESERVOIR.alt + 5 - alt; // ~5m above reservoir for tank height
    if (head < 3) return "oklch(0.6 0.2 25)"; // red — insufficient
    if (head < 10) return "oklch(0.75 0.16 75)"; // orange — marginal
    return "oklch(0.62 0.14 155)"; // green — good
  };

  // ---------- Layer toggle state ----------
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    households: true,
    tower: true,
    wells: true,
    pumps: true,
    schools: true,
    demand: false,
    altitude: false,
    contours: false,
    network: true,
    pressure: true,
  });
  const toggle = (k: LayerKey) => setLayers((s) => ({ ...s, [k]: !s[k] }));

  const [hover, setHover] = useState<{ p: Point; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<Point | null>(null);

  // ----- Zoom & pan state -----
  const [view, setView] = useState({ cx: W / 2, cy: H / 2, zoom: 1 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  const vbW = W / view.zoom;
  const vbH = H / view.zoom;
  const vbX = view.cx - vbW / 2;
  const vbY = view.cy - vbH / 2;

  const clampCenter = (cx: number, cy: number, zoom: number) => {
    const halfW = W / zoom / 2;
    const halfH = H / zoom / 2;
    return {
      cx: Math.max(halfW, Math.min(W - halfW, cx)),
      cy: Math.max(halfH, Math.min(H - halfH, cy)),
    };
  };

  const zoomAt = (factor: number, sx?: number, sy?: number) => {
    setView((v) => {
      const nz = Math.max(1, Math.min(8, v.zoom * factor));
      // zoom centered on cursor if provided, else center
      const px = sx ?? v.cx;
      const py = sy ?? v.cy;
      const ncx = px + (v.cx - px) * (v.zoom / nz);
      const ncy = py + (v.cy - py) * (v.zoom / nz);
      const c = clampCenter(ncx, ncy, nz);
      return { cx: c.cx, cy: c.cy, zoom: nz };
    });
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = vbX + ((e.clientX - rect.left) / rect.width) * vbW;
    const sy = vbY + ((e.clientY - rect.top) / rect.height) * vbH;
    zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, sx, sy);
  };

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).tagName === "circle" || (e.target as Element).tagName === "rect" || (e.target as Element).tagName === "polygon") {
      // Only pan when starting on background
      const cls = (e.target as Element).getAttribute("class") || "";
      if (cls.includes("cursor-pointer")) return;
    }
    dragRef.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
  };
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = ((e.clientX - dragRef.current.x) / rect.width) * vbW;
    const dy = ((e.clientY - dragRef.current.y) / rect.height) * vbH;
    setView((v) => {
      const c = clampCenter(dragRef.current!.cx - dx, dragRef.current!.cy - dy, v.zoom);
      return { ...v, cx: c.cx, cy: c.cy };
    });
  };
  const endDrag = () => { dragRef.current = null; };

  // Altitude/demand color scales
  const altMin = 350, altMax = 378;
  const altColor = (a: number) => {
    const t = Math.max(0, Math.min(1, (a - altMin) / (altMax - altMin)));
    const hue = 140 - t * 140;
    return `oklch(0.7 0.16 ${hue})`;
  };
  const demandColor = (d: number) => {
    const t = Math.max(0, Math.min(1, (d - 40) / 180));
    const hue = 60 - t * 40;
    return `oklch(${0.78 - t * 0.15} ${0.12 + t * 0.08} ${hue})`;
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_240px]">
      {/* MAP */}
      <div className="relative overflow-hidden rounded-lg border bg-[oklch(0.97_0.005_230)] shadow-sm">
        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className={`block h-[560px] w-full ${dragRef.current ? "cursor-grabbing" : "cursor-grab"}`}
          onMouseLeave={() => { setHover(null); endDrag(); }}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
        >

          <defs>
            <radialGradient id="land" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="oklch(0.97 0.02 130)" />
              <stop offset="100%" stopColor="oklch(0.95 0.01 230)" />
            </radialGradient>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.92 0.01 240)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="heat" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.65" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#land)" />
          <rect width={W} height={H} fill="url(#grid)" />

          {/* Coordinate ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const lat = BOUNDS.latMin + t * (BOUNDS.latMax - BOUNDS.latMin);
            const y = H - PAD - t * (H - 2 * PAD);
            return (
              <g key={`lt${t}`}>
                <line x1={PAD - 4} y1={y} x2={PAD} y2={y} stroke="oklch(0.5 0.02 250)" strokeWidth="0.5" />
                <text x={4} y={y + 3} fontSize="8" fill="oklch(0.5 0.02 250)" className="num">
                  {lat.toFixed(3)}°
                </text>
              </g>
            );
          })}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const lon = BOUNDS.lonMin + t * (BOUNDS.lonMax - BOUNDS.lonMin);
            const x = PAD + t * (W - 2 * PAD);
            return (
              <g key={`ln${t}`}>
                <line x1={x} y1={H - PAD} x2={x} y2={H - PAD + 4} stroke="oklch(0.5 0.02 250)" strokeWidth="0.5" />
                <text x={x} y={H - 6} fontSize="8" textAnchor="middle" fill="oklch(0.5 0.02 250)" className="num">
                  {lon.toFixed(3)}°
                </text>
              </g>
            );
          })}

          {/* Altitude heatmap (behind everything) */}
          {layers.altitude &&
            data.map((p) => {
              const xy = project(p.lat, p.lon);
              return (
                <circle
                  key={`a${p.id}`}
                  cx={xy.x}
                  cy={xy.y}
                  r={36}
                  fill={altColor(p.alt)}
                  opacity={0.22}
                />
              );
            })}

          {/* Demand heatmap */}
          {layers.demand &&
            householdsAll.map((p) => {
              const xy = project(p.lat, p.lon);
              return (
                <circle
                  key={`d${p.id}`}
                  cx={xy.x}
                  cy={xy.y}
                  r={30}
                  fill={demandColor(p.demandL || 80)}
                  opacity={0.32}
                />
              );
            })}

          {/* Elevation contours (concentric ellipses around hilltop centroid) */}
          {layers.contours && (() => {
            const hilltop = project(BOUNDS.latMin + 0.012, BOUNDS.lonMin + 0.006);
            return (
              <g opacity="0.45">
                {[1, 1.6, 2.3, 3.1, 4.0, 5.0].map((k, i) => (
                  <ellipse key={i} cx={hilltop.x} cy={hilltop.y} rx={50 * k} ry={36 * k} fill="none" stroke="oklch(0.55 0.1 60)" strokeWidth="0.7" strokeDasharray="3 2" />
                ))}
                <text x={hilltop.x + 6} y={hilltop.y - 4} fontSize="9" fill="oklch(0.45 0.1 60)" fontWeight="600">378 m</text>
              </g>
            );
          })()}

          {/* Proposed pipe network — scenario aware, pressure-zone colored */}
          {layers.network && (
            <g>
              {/* Trunk: tower → each fountain */}
              {proposedFountains.map((f, i) => {
                const xy = project(f.cLat, f.cLon);
                const fakeAlt = 360;
                const stroke = layers.pressure ? pressureColor(fakeAlt) : "oklch(0.66 0.14 235)";
                return (
                  <line
                    key={`pf${i}`}
                    x1={reservoirXY.x}
                    y1={reservoirXY.y}
                    x2={xy.x}
                    y2={xy.y}
                    stroke={stroke}
                    strokeWidth="2.8"
                    opacity="0.9"
                  />
                );
              })}
              {/* Household feeder lines */}
              {householdsAll
                .filter((p) => connectedIds.has(p.id))
                .map((p) => {
                  const xy = project(p.lat, p.lon);
                  const stroke = layers.pressure ? pressureColor(p.alt) : "oklch(0.66 0.14 235)";
                  const inPhase = phaseHHIds && phaseHHIds.has(p.id);
                  return (
                    <line
                      key={`ph${p.id}`}
                      x1={reservoirXY.x}
                      y1={reservoirXY.y}
                      x2={xy.x}
                      y2={xy.y}
                      stroke={stroke}
                      strokeWidth={inPhase ? 1.6 : 0.7}
                      opacity={inPhase ? 0.95 : phaseHHIds ? 0.15 : 0.55}
                    />
                  );
                })}
            </g>
          )}

          {/* Warning markers for households above gravity (>373m) */}
          {householdsAll.filter((p) => p.alt > RESERVOIR_ELEV_THRESH).map((p) => {
            const xy = project(p.lat, p.lon);
            return (
              <g key={`warn${p.id}`} className="cursor-pointer" onMouseEnter={() => setHover({ p, x: xy.x, y: xy.y })} onClick={() => setSelected(p)}>
                <polygon points={`${xy.x},${xy.y - 9} ${xy.x + 8},${xy.y + 5} ${xy.x - 8},${xy.y + 5}`} fill="oklch(0.7 0.22 30)" stroke="white" strokeWidth="1.2" />
                <text x={xy.x} y={xy.y + 3.5} fontSize="9" fontWeight="700" textAnchor="middle" fill="white">!</text>
              </g>
            );
          })}

          {/* Wells */}
          {layers.wells &&
            wells.map((p) => {
              const xy = project(p.lat, p.lon);
              return (
                <polygon
                  key={p.id}
                  points={`${xy.x},${xy.y - 5} ${xy.x + 4.5},${xy.y + 3} ${xy.x - 4.5},${xy.y + 3}`}
                  fill="oklch(0.7 0.17 35)"
                  stroke="white"
                  strokeWidth="0.7"
                  onMouseEnter={() => setHover({ p, x: xy.x, y: xy.y })}
                  onClick={() => setSelected(p)}
                  className="cursor-pointer"
                />
              );
            })}

          {/* Pumps */}
          {layers.pumps &&
            pumps.map((p) => {
              const xy = project(p.lat, p.lon);
              return (
                <g
                  key={p.id}
                  onMouseEnter={() => setHover({ p, x: xy.x, y: xy.y })}
                  onClick={() => setSelected(p)}
                  className="cursor-pointer"
                >
                  <rect x={xy.x - 4} y={xy.y - 4} width={8} height={8} fill="oklch(0.62 0.14 155)" stroke="white" strokeWidth="0.8" />
                  <line x1={xy.x - 2} y1={xy.y} x2={xy.x + 2} y2={xy.y} stroke="white" strokeWidth="1.2" />
                  <line x1={xy.x} y1={xy.y - 2} x2={xy.x} y2={xy.y + 2} stroke="white" strokeWidth="1.2" />
                </g>
              );
            })}

          {/* Schools / commerces */}
          {layers.schools &&
            schools.map((p) => {
              const xy = project(p.lat, p.lon);
              return (
                <rect
                  key={p.id}
                  x={xy.x - 4.5}
                  y={xy.y - 4.5}
                  width={9}
                  height={9}
                  fill="oklch(0.25 0.02 250)"
                  stroke="white"
                  strokeWidth="0.7"
                  onMouseEnter={() => setHover({ p, x: xy.x, y: xy.y })}
                  onClick={() => setSelected(p)}
                  className="cursor-pointer"
                />
              );
            })}

          {/* Households */}
          {layers.households &&
            householdsAll.map((p) => {
              const xy = project(p.lat, p.lon);
              const isAbove = p.alt > RESERVOIR_ELEV_THRESH;
              const connected = connectedIds.has(p.id);
              const irrig = p.type === "household-irr";
              const fill = isAbove
                ? "oklch(0.6 0.2 25)"
                : connected
                ? "oklch(0.38 0.12 250)"
                : irrig
                ? "oklch(0.66 0.14 235)"
                : "oklch(0.65 0.01 250)";
              return (
                <circle
                  key={p.id}
                  cx={xy.x}
                  cy={xy.y}
                  r={irrig ? 3.4 : connected ? 3 : 2.4}
                  fill={fill}
                  opacity={0.95}
                  stroke={selected?.id === p.id ? "oklch(0.2 0.02 250)" : "none"}
                  strokeWidth={selected?.id === p.id ? 1.5 : 0}
                  onMouseEnter={() => setHover({ p, x: xy.x, y: xy.y })}
                  onClick={() => setSelected(p)}
                  className="cursor-pointer"
                />
              );
            })}

          {/* Proposed fountains */}
          {layers.network &&
            proposedFountains.map((f, i) => {
              const xy = project(f.cLat, f.cLon);
              return (
                <g key={`fnt${i}`}>
                  <circle cx={xy.x} cy={xy.y} r={11} fill="oklch(0.62 0.14 155 / 0.2)" />
                  <circle cx={xy.x} cy={xy.y} r={6} fill="oklch(0.62 0.14 155)" stroke="white" strokeWidth="1.5" />
                </g>
              );
            })}

          {/* Water tower */}
          {layers.tower && (
            <g>
              <circle cx={reservoirXY.x} cy={reservoirXY.y} r={22} fill="oklch(0.38 0.12 250 / 0.18)" />
              <circle
                cx={reservoirXY.x}
                cy={reservoirXY.y}
                r={13}
                fill="oklch(0.38 0.12 250)"
                stroke="white"
                strokeWidth="2.5"
                onMouseEnter={() => setHover({ p: reservoir, x: reservoirXY.x, y: reservoirXY.y })}
                onClick={() => setSelected(reservoir)}
                className="cursor-pointer"
              />
              <text
                x={reservoirXY.x + 20}
                y={reservoirXY.y - 16}
                fontSize="10"
                fontWeight="700"
                fill="oklch(0.38 0.12 250)"
              >
                Château d'eau · 40 m³
              </text>
            </g>
          )}
        </svg>

        {/* Hover tooltip */}
        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-card/95 px-2.5 py-1.5 text-[11px] shadow-lg backdrop-blur"
            style={{ left: `${((hover.x - vbX) / vbW) * 100}%`, top: `${((hover.y - vbY) / vbH) * 100}%` }}
          >
            <div className="font-semibold">{labelFor(hover.p)}</div>
            <div className="num text-muted-foreground">
              {hover.p.lat.toFixed(4)}°N · {hover.p.lon.toFixed(4)}°E · {hover.p.alt.toFixed(0)} m
            </div>
            {hover.p.hhSize && (
              <div className="num text-muted-foreground">
                {hover.p.hhSize} pers · {hover.p.demandL} L/j
              </div>
            )}
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute left-3 top-3 flex flex-col gap-1 rounded-md border bg-card/95 p-1 shadow-sm backdrop-blur">
          <button onClick={() => zoomAt(1.4)} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" title="Zoom in">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => zoomAt(1 / 1.4)} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" title="Zoom out">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView({ cx: W / 2, cy: H / 2, zoom: 1 })}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Reset view"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <div className="num px-1 text-center text-[9px] font-semibold text-muted-foreground">{view.zoom.toFixed(1)}×</div>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md border bg-card/95 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
          <Layers className="h-3 w-3" /> Scale 1 : {Math.round(8000 / view.zoom)} · CRS WGS84 · Sansalé, Boké · scroll/drag to navigate
        </div>


        {/* Top-right legend for active heatmap */}
        {(layers.altitude || layers.demand) && (
          <div className="absolute right-3 top-3 rounded-md border bg-card/95 p-2 text-[10px] shadow-sm backdrop-blur">
            {layers.altitude && (
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Altitude (m)</div>
                <div className="flex items-center gap-1">
                  <span className="num">{altMin}</span>
                  <div className="h-2 w-24 rounded" style={{ background: "linear-gradient(to right, oklch(0.7 0.16 140), oklch(0.7 0.16 70), oklch(0.7 0.16 0))" }} />
                  <span className="num">{altMax}</span>
                </div>
              </div>
            )}
            {layers.demand && (
              <div className={layers.altitude ? "mt-2" : ""}>
                <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Demand (L/j)</div>
                <div className="flex items-center gap-1">
                  <span className="num">40</span>
                  <div className="h-2 w-24 rounded" style={{ background: "linear-gradient(to right, oklch(0.78 0.12 60), oklch(0.63 0.2 20))" }} />
                  <span className="num">220</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pressure zone legend */}
        {layers.network && layers.pressure && (
          <div className="absolute right-3 bottom-3 rounded-md border bg-card/95 p-2 text-[10px] shadow-sm backdrop-blur">
            <div className="mb-1 flex items-center gap-1 font-semibold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-3 w-3" /> Pressure zones
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm bg-[oklch(0.62_0.14_155)]" />&gt;10 m H₂O · good</div>
              <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm bg-[oklch(0.75_0.16_75)]" />3–10 m · marginal</div>
              <div className="flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-sm bg-[oklch(0.6_0.2_25)]" />&lt;3 m · insufficient</div>
            </div>
          </div>
        )}
      </div>

      {/* SIDE PANEL — Layers & details */}
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Layers className="h-3 w-3" /> Map Layers
          </div>
          <ul className="space-y-1.5">
            {LAYER_META.map((l) => (
              <li key={l.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-muted/60">
                  <input
                    type="checkbox"
                    checked={layers[l.key]}
                    onChange={() => toggle(l.key)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <span className={`inline-block h-2 w-2 rounded-full ${l.color}`} />
                  <span className="text-foreground">{l.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-md border border-dashed bg-muted/30 p-2 text-[10px] italic text-muted-foreground">
            + Future simulation layers (pressure zones, leak risk, expansion phases) can be added here.
          </div>
        </div>

        {/* Selection details */}
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Feature Details</span>
            {selected && (
              <button onClick={() => setSelected(null)} className="rounded p-0.5 hover:bg-muted">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {!selected && (
            <div className="text-[11px] text-muted-foreground">
              Hover any point for a tooltip. Click a household, well, pump or the water tower to inspect its attributes.
            </div>
          )}
          {selected && (
            <div className="space-y-2 text-xs">
              <div className="text-sm font-semibold">{labelFor(selected)}</div>
              <DetailRow label="Coordinates" value={`${selected.lat.toFixed(5)}°N, ${selected.lon.toFixed(5)}°E`} />
              <DetailRow label="Altitude" value={`${selected.alt.toFixed(1)} m`} tone={selected.alt > RESERVOIR_ELEV_THRESH ? "bad" : undefined} />
              {selected.hhSize && <DetailRow label="Household size" value={`${selected.hhSize} persons`} />}
              {selected.demandL && <DetailRow label="Daily water demand" value={`${selected.demandL} L/day`} />}
              {selected.type !== "reservoir" && (
                <DetailRow
                  label="Distance to tower"
                  value={`${Math.round(distM(selected, reservoir))} m`}
                />
              )}
              {selected.hhSize && (
                <DetailRow
                  label="Gravity supply"
                  value={selected.alt > RESERVOIR_ELEV_THRESH ? "Not feasible (above 373 m)" : "Feasible"}
                  tone={selected.alt > RESERVOIR_ELEV_THRESH ? "bad" : "good"}
                />
              )}
              {selected.type === "reservoir" && (
                <>
                  <DetailRow label="Volume" value="40 m³" />
                  <DetailRow label="Sustainable yield" value="37 m³ / day" />
                </>
              )}
            </div>
          )}
        </div>

        {/* Dataset summary */}
        <div className="rounded-lg border bg-card p-3 text-[11px] shadow-sm">
          <div className="mb-1.5 font-semibold uppercase tracking-wider text-muted-foreground">Dataset</div>
          <ul className="num space-y-0.5 text-muted-foreground">
            <li>Households: <span className="font-semibold text-foreground">{householdsAll.length}</span></li>
            <li>Wells: <span className="font-semibold text-foreground">{wells.length}</span></li>
            <li>Hand pumps: <span className="font-semibold text-foreground">{pumps.length}</span></li>
            <li>Schools / commerces: <span className="font-semibold text-foreground">{schools.length}</span></li>
            <li>Above gravity (&gt; 373 m): <span className="font-semibold text-destructive">{householdsAll.filter((p) => p.alt > RESERVOIR_ELEV_THRESH).length}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function labelFor(p: Point) {
  switch (p.type) {
    case "household":
      return "Household";
    case "household-irr":
      return "Household (irrigation)";
    case "well":
      return p.label || "Open well";
    case "pump":
      return p.label || "Hand pump";
    case "school":
      return p.label || "School / Commerce";
    case "reservoir":
      return p.label || "Water tower";
  }
}

function DetailRow({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const cls = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-2 border-t pt-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num font-semibold ${cls}`}>{value}</span>
    </div>
  );
}
