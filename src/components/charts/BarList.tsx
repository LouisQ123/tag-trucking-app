"use client";

import { useState } from "react";

export interface BarDatum {
  label: string;
  value: number;
}

export default function BarList({
  data,
  color,
  unit,
  valueFmt,
}: {
  data: BarDatum[];
  color: string;
  unit?: string;
  valueFmt?: (v: number) => string;
}) {
  const [hover, setHover] = useState<{ x: number; y: number; label: string; value: string } | null>(
    null
  );

  if (!data.length) {
    return <p className="text-[12.5px] text-muted text-center py-6">No data for this range.</p>;
  }

  const max = Math.max(...data.map((d) => d.value)) || 1;
  const fmt = valueFmt ?? ((v: number) => v.toLocaleString());

  return (
    <div className="flex flex-col gap-2.5 relative">
      {data.map((d) => {
        const pct = Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0);
        return (
          <div key={d.label} className="flex items-center gap-2.5 h-[26px]">
            <div className="w-[108px] flex-none text-right text-[12px] text-ink-2 truncate" title={d.label}>
              {d.label}
            </div>
            <div className="flex-1 relative h-[14px]">
              <svg
                width="100%"
                height="14"
                viewBox="0 0 200 14"
                preserveAspectRatio="none"
                style={{ overflow: "visible", display: "block" }}
                onMouseMove={(e) =>
                  setHover({
                    x: e.clientX,
                    y: e.clientY,
                    label: d.label,
                    value: `${fmt(d.value)}${unit ? " " + unit : ""}`,
                  })
                }
                onMouseLeave={() => setHover(null)}
              >
                <rect x={0} y={5} width={200} height={4} rx={2} fill="var(--grid)" />
                <rect
                  x={0}
                  y={2}
                  width={Math.max(pct * 2, d.value > 0 ? 6 : 0)}
                  height={10}
                  rx={4}
                  fill={color}
                  style={{ cursor: "pointer" }}
                  opacity={hover?.label === d.label ? 0.82 : 1}
                />
              </svg>
            </div>
            <div className="w-16 flex-none text-[12.5px] font-bold tabular-nums">
              {fmt(d.value)}
              {unit ? ` ${unit}` : ""}
            </div>
          </div>
        );
      })}
      {hover && (
        <div
          className="fixed z-50 pointer-events-none bg-ink text-page text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-lg"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div>{hover.label}</div>
          <div className="text-[11px] font-medium mt-0.5" style={{ color: "var(--page)", opacity: 0.7 }}>
            {hover.value}
          </div>
        </div>
      )}
    </div>
  );
}
