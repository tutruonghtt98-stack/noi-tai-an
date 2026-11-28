"use client";
import { useId, useState } from "react";

const SVG_WIDTH = 100; // viewBox units; svg scales responsively via width=100%
const SVG_HEIGHT = 56;
const SVG_RENDER_HEIGHT = 120; // px, matches TrendBarChart's rendered height
const VERTICAL_PAD = 6; // viewBox units of headroom so extreme points aren't clipped
const MARKER_SIZE = 10; // px — rendered as an absolutely-positioned div, NOT an svg <circle>,
// because this chart's svg uses preserveAspectRatio="none" (non-uniform x/y scaling): a
// viewBox-unit <circle r> would be stretched into an ellipse and could end up under 8px in
// one dimension. A fixed-pixel div sidesteps that entirely and stays a true circle.
const LABEL_GAP = 14; // px between a point and its month label

function formatTick(v: number): string {
  const r = Math.round(v);
  return `${r > 0 ? "+" : ""}${r}%`;
}

export function TrendLineChart({
  data,
  color,
}: {
  data: { label: string; value: number }[];
  color: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const gradientId = useId();

  const n = data.length;
  const values = data.map((d) => d.value);
  // Domain always includes zero so the baseline is in range whether values are all
  // negative, all positive, or straddle zero — never assume positive-only data.
  const domainMin = Math.min(0, ...values);
  const domainMax = Math.max(0, ...values);
  const isFlat = domainMax === domainMin; // e.g. every value is 0 — nothing to scale, so don't pin it to one edge
  const range = domainMax - domainMin || 1; // guard against a degenerate all-zero series

  const plotTop = VERTICAL_PAD;
  const plotBottom = SVG_HEIGHT - VERTICAL_PAD;
  const plotHeight = plotBottom - plotTop;
  // Slightly below the geometric midpoint: the point labels sit below the line, so a line
  // drawn at the exact center still reads as "too high" against the card's bottom edge.
  const plotCenter = plotTop + plotHeight * 0.62;

  // A flat series (all values equal, usually all 0) has no real variation to scale —
  // draw it centered in the plot instead of pinned to plotBottom, which otherwise looks
  // like the line is hugging the card's bottom edge rather than sitting in the chart.
  const yFor = (value: number) => (isFlat ? plotCenter : plotBottom - ((value - domainMin) / range) * plotHeight);
  const xFor = (i: number) => (n > 1 ? (i / (n - 1)) * SVG_WIDTH : SVG_WIDTH / 2);

  const baselineY = yFor(0);

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(2)},${yFor(d.value).toFixed(2)}`)
    .join(" ");
  // Filled only between the line and the zero baseline — not the chart's bottom edge —
  // so a flat-at-zero series shows no fill, and only the portion above the baseline fills.
  const areaPath = n > 1 ? `${linePath} L${xFor(n - 1).toFixed(2)},${baselineY.toFixed(2)} L${xFor(0).toFixed(2)},${baselineY.toFixed(2)} Z` : "";

  // Y axis: top (max) and zero-baseline reference ticks, deduplicated when the series never goes above 0.
  const yTicks = domainMax > 0 ? [domainMax, 0] : [0];

  return (
    <div className="flex gap-2">
      <div
        className={`flex shrink-0 flex-col py-1.5 text-right text-[10px] tabular-nums text-muted ${yTicks.length > 1 ? "justify-between" : "justify-center"}`}
        style={{ height: SVG_RENDER_HEIGHT }}
      >
        {yTicks.map((v) => (
          <span key={v}>{formatTick(v)}</span>
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          width="100%"
          height={SVG_RENDER_HEIGHT}
          preserveAspectRatio="none"
          role="img"
          aria-label="Trend line chart"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {n > 1 && <path d={areaPath} fill={`url(#${gradientId})`} />}
          {yTicks.map((v) => (
            <line
              key={v}
              x1={0}
              y1={yFor(v)}
              x2={SVG_WIDTH}
              y2={yFor(v)}
              stroke="currentColor"
              className="text-line"
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
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
          // Centered under its dot, except the first/last point: those shift the label
          // inward (growing right/left respectively) so it doesn't overflow the card edge.
          const labelTranslateX = i === 0 ? "0" : i === n - 1 ? "-100%" : "-50%";
          return (
            <div key={i}>
              <div
                className="absolute rounded-full border-2 bg-surface"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: MARKER_SIZE,
                  height: MARKER_SIZE,
                  transform: "translate(-50%, -50%)",
                  borderColor: color,
                  opacity: hovered === null || hovered === i ? 1 : 0.55,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
              <div
                className="pointer-events-none absolute whitespace-nowrap text-[10px] text-muted"
                style={{
                  left: `${leftPct}%`,
                  top: `calc(${topPct}% + ${LABEL_GAP}px)`,
                  transform: `translate(${labelTranslateX}, 0)`,
                }}
              >
                {d.label}
              </div>
            </div>
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
    </div>
  );
}
