"use client";
import { useState } from "react";

const SVG_WIDTH = 100; // viewBox units; svg scales responsively via width=100%
const SVG_HEIGHT = 56;
const SVG_RENDER_HEIGHT = 120; // px, matches TrendBarChart's rendered height
const VERTICAL_PAD = 6; // viewBox units of headroom so extreme points aren't clipped
const MARKER_SIZE = 10; // px — rendered as an absolutely-positioned div, NOT an svg <circle>,
// because this chart's svg uses preserveAspectRatio="none" (non-uniform x/y scaling): a
// viewBox-unit <circle r> would be stretched into an ellipse and could end up under 8px in
// one dimension. A fixed-pixel div sidesteps that entirely and stays a true circle.

export function TrendLineChart({
  data,
  color,
}: {
  data: { label: string; value: number }[];
  color: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const n = data.length;
  const values = data.map((d) => d.value);
  // Domain always includes zero so the baseline is in range whether values are all
  // negative, all positive, or straddle zero — never assume positive-only data.
  const domainMin = Math.min(0, ...values);
  const domainMax = Math.max(0, ...values);
  const range = domainMax - domainMin || 1; // guard against a degenerate all-zero series

  const plotTop = VERTICAL_PAD;
  const plotBottom = SVG_HEIGHT - VERTICAL_PAD;
  const plotHeight = plotBottom - plotTop;

  const yFor = (value: number) => plotBottom - ((value - domainMin) / range) * plotHeight;
  const xFor = (i: number) => (n > 1 ? (i / (n - 1)) * SVG_WIDTH : SVG_WIDTH / 2);

  const baselineY = yFor(0);

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(2)},${yFor(d.value).toFixed(2)}`)
    .join(" ");

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        height={SVG_RENDER_HEIGHT}
        preserveAspectRatio="none"
        role="img"
        aria-label="Trend line chart"
      >
        <line
          x1={0}
          y1={baselineY}
          x2={SVG_WIDTH}
          y2={baselineY}
          stroke="currentColor"
          className="text-line"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {n > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {data.map((d, i) => {
        const leftPct = n > 1 ? (i / (n - 1)) * 100 : 50;
        const topPct = (yFor(d.value) / SVG_HEIGHT) * 100;
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: MARKER_SIZE,
              height: MARKER_SIZE,
              transform: "translate(-50%, -50%)",
              backgroundColor: color,
              opacity: hovered === null || hovered === i ? 1 : 0.55,
              cursor: "pointer",
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        );
      })}

      {hovered !== null && data[hovered] && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-pop"
          style={{
            left: `${n > 1 ? (hovered / (n - 1)) * 100 : 50}%`,
            top: `${(yFor(data[hovered].value) / SVG_HEIGHT) * 100}%`,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
        >
          <div className="font-medium text-ink">{data[hovered].label}</div>
          <div className="tabular-nums text-muted">{data[hovered].value}%</div>
        </div>
      )}
    </div>
  );
}
