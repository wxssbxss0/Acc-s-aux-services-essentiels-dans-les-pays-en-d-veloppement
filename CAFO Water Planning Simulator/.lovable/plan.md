# CAFO Simulator v2 Upgrade Plan

Keep existing layout, branding, i18n, and control panel. Add features as new components composed into `src/routes/index.tsx` and `src/components/cafo/ProjectMap.tsx`. No backend rewrites unless noted.

## 1. Dashboard defaults to Hybrid scenario
- Add `activeScenario` state (default `"hybrid"`). KPI cards, executive summary, risk panel, and recommendation read from the active scenario's pre-computed metrics, not the full-network simulation output.
- Small segmented toggle above KPI grid: `Fountains | Hybrid (recommended) | Full Network`.
- Green "Within budget" / red "Over budget" badge driven by `cost ≤ 220000`.

## 2. Pipe network overlay on map
- In `ProjectMap.tsx` add a `pipes` layer: polylines from water tower → fountain nodes → household clusters.
- Color by pressure zone derived from household altitude vs tower altitude (>10 mH2O green, 3–10 orange, <3 red). Households >373m get a warning triangle marker.
- New toggleable "Elevation contours" layer: concentric ellipses around hilltop centroid at 5m intervals (approximated from elevation data range).
- Pipe network shape responds to `activeScenario`:
  - Fountains: trunk + 5 fountains only
  - Hybrid: trunk + fountains + connections to dense cluster
  - Full: dense star to every household

## 3. Phased 20-year investment timeline
- New `PhaseTimeline` component: 4 horizontal Gantt cards (Phase 1–4) with years, cost, newly-served population, cumulative coverage %.
- Click → sets `selectedPhase`, which highlights the corresponding households on the map (passed as prop to `ProjectMap`).
- Sits below KPIs, above the demand chart.

## 4. Animated 20-year demand chart
- Replace single chart with new `DemandForecastChart` using recharts (already in stack assumed; verify).
- Three lines: Population, Daily demand (m³), Capacity (flat 37).
- Red shaded zone where demand ≥ 33.3 (90% of capacity).
- Vertical reference lines for phase milestones + "Budget depleted" marker (when cumulative cost > 220k).
- Play button animates year 2025→2045 with setInterval; updates a `simYear` state that also pulses the KPI cards.

## 5. AI Advisor sidebar (Lovable AI, not Anthropic direct)
- User requested Claude/Anthropic. Per platform defaults, route through **Lovable AI Gateway** using `google/gemini-3-flash-preview` by default, OR use `anthropic/claude-sonnet-4` if available via gateway. I'll use Lovable AI Gateway with claude model string if supported; otherwise gemini. No user API key needed — `LOVABLE_API_KEY` auto-provisioned.
- New TanStack server route `src/routes/api/advisor.ts` streaming chat via AI SDK `streamText`.
- Collapsible right drawer `AdvisorPanel` with 3 starter chips, `useChat` from `@ai-sdk/react`.
- Project context injected as system prompt server-side.

## 6. Investor Pitch Mode
- "Présenter" button in header → full-screen modal `PitchMode` with 6 slides, keyboard arrow nav, slide counter.
- Slides composed from existing data (no new computations needed).

## 7. Interactive scenario comparison
- Existing scenario table rows become clickable → sets `activeScenario` (drives dashboard + map).
- Add a tiny sparkline (`<svg>`-based mini cumulative cost line) under each scenario.

## 8. Export PDF
- Add "Export PDF" button. Use browser `window.print()` with a print-only stylesheet that hides chrome and shows a `#print-summary` section (project overview, recommended metrics, projection chart snapshot via SVG, budget breakdown). Avoids adding heavy PDF libs.

## Technical notes
- Files added:
  - `src/components/cafo/PhaseTimeline.tsx`
  - `src/components/cafo/DemandForecastChart.tsx`
  - `src/components/cafo/AdvisorPanel.tsx`
  - `src/components/cafo/PitchMode.tsx`
  - `src/components/cafo/PrintSummary.tsx`
  - `src/routes/api/advisor.ts`
  - `src/lib/ai-gateway.server.ts` (gateway helper)
- Files modified: `src/routes/index.tsx`, `src/components/cafo/ProjectMap.tsx`, `src/styles.css` (print styles).
- Dependencies to add: `ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`, `recharts` (if not present), `zod` (if not present).
- AI model: Lovable AI Gateway. Will try `anthropic/claude-sonnet-4` first; if not in catalog, fall back to `google/gemini-3-flash-preview`. The user mentioned Anthropic specifically but doesn't require their direct API — gateway is the platform default and avoids asking for a key.

## Out of scope / deferred
- True GIS contour generation from elevation raster — using approximated concentric contours.
- Real-time map animation during chart play — only KPIs animate; map stays on `activeScenario`/`selectedPhase`.
- True PDF generation library — using print stylesheet (faster, no deps; user can "Save as PDF" from the browser print dialog).

Confirm and I'll build it. Anything you want to drop or reprioritize?
