"use client";

import { useState } from "react";

export interface TrendPoint {
  label: string;
  shortLabel: string;
  value: number;
}

export default function TrendChart({
  points,
  color,
  unit,
}: {
  points: TrendPoint[];
  color: string;
  unit?: string;
}) {
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);

  if (points.length < 2) {
    return (
      <p className="text-[12.5px] text-muted text-center py-6">
        Need at least two days of data to show a trend.
      </p>
    );
  }

  const W = 760,
    H = 190,
    padL = 34,
    padR = 12,
    padT = 14,
    padB = 26;
  const innerW = W - padL - padR,
    innerH = H - padT - padB;
  const rawMax = Math.max(...points.map((p) => p.value));
  const max = rawMax <= 0 ? 1 : rawMax * 1.2;
  const n = points.length;
  const xFor = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yFor = (v: number) => padT + innerH - (v / max) * innerH;

  const linePts = points.map((p, i) => `${xFor(i)},${yFor(p.value)}`);
  const areaPath = `M${xFor(0)},${yFor(0)} L${linePts.join(" L")} L${xFor(n - 1)},${yFor(0)} Z`;
  const labelEvery = Math.ceil(n / 6);
  const gridSteps = 3;

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        {Array.from({ length: gridSteps + 1 }).map((_, g) => {
          const gy = padT + (innerH / gridSteps) * g;
          const gval = Math.round(max - (max / gridSteps) * g);
          return (
            <g key={g}>
              <line x1={padL} x2={W - padR} y1={gy} y2={gy} stroke="var(--grid)" strokeWidth={1} />
              <text x={padL - 8} y={gy + 3} textAnchor="end" fontSize={10} fill="var(--muted)">
                {gval}
              </text>
            </g>
          );
        })}

        {points.map((p, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={xFor(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">
              {p.shortLabel}
            </text>
          ) : null
        )}

        <path d={areaPath} fill={color} opacity={0.14} stroke="none" />
        <path
          d={`M${linePts.join(" L")}`}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={xFor(n - 1)} cy={yFor(points[n - 1].value)} r={5} fill="var(--surface)" stroke={color} strokeWidth={2} />

        {hover && (
          <line
            x1={xFor(hover.i)}
            x2={xFor(hover.i)}
            y1={padT}
            y2={padT + innerH}
            stroke="var(--ink-2)"
            strokeWidth={1}
          />
        )}

        {points.map((p, i) => (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.value)}
            r={10}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY, i })}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {hover && (
        <div
          className="fixed z-50 pointer-events-none bg-ink text-page text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-lg"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {points[hover.i].label}: {points[hover.i].value}
          {unit ?? ""}
        </div>
      )}
    </div>
  );
}
