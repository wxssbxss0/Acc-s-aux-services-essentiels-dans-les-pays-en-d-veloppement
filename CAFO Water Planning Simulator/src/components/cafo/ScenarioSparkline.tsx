export function ScenarioSparkline({ cost, color = "oklch(0.38 0.12 250)" }: { cost: number; color?: string }) {
  // Simple cumulative S-curve approximating 4-phase rollout
  const phases = [0.38, 0.32, 0.20, 0.10];
  const pts: { x: number; y: number }[] = [];
  let cum = 0;
  pts.push({ x: 0, y: 0 });
  phases.forEach((p, i) => {
    cum += p;
    pts.push({ x: i + 1, y: cum * cost });
  });
  const W = 100, H = 28;
  const maxY = cost;
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(p.x / 4) * W} ${H - (p.y / maxY) * H}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-7 w-full">
      <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill={color} fillOpacity="0.12" />
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}
