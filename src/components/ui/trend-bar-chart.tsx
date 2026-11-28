"use client";
import { useState } from "react";
import { vnd } from "@/lib/billing";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";

const SVG_WIDTH = 100; // viewBox units; svg scales responsively via width=100%
const SVG_HEIGHT = 56;
const BAR_GAP_RATIO = 0.3; // fraction of each slot's width used as gap
const BAR_RADIUS = 1.6; // ~4px at typical rendered widths
const LABEL_EVERY = 5;

/** 3-point simple moving average, centered (edges use available neighbors). */
function movingAverage3(values: number[]): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - 1);
    const end = Math.min(values.length - 1, i + 1);
    const slice = values.slice(start, end + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export function TrendBarChart({
  data,
  color,
  title,
  deltaPercent,
}: {
  data: { label: string; value: number }[];
  color: string;
  title: string;
  deltaPercent: number | null;
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState<number | null>(null);

  const n = data.length;
  const values = data.map((d) => d.value);
  const maxValue = Math.max(1, ...values);
  const currentValue = n > 0 ? data[n - 1].value : 0;

  const slotWidth = n > 0 ? SVG_WIDTH / n : 0;
  const barWidth = slotWidth * (1 - BAR_GAP_RATIO);
  const barOffset = (slotWidth - barWidth) / 2;

  const barHeight = (value: number) => (maxValue > 0 ? (value / maxValue) * (SVG_HEIGHT - 4) : 0);
  const barY = (value: number) => SVG_HEIGHT - barHeight(value);
  const barCenterX = (i: number) => i * slotWidth + slotWidth / 2;

  const smoothed = movingAverage3(values);
  const trendPath = smoothed
    .map((v, i) => {
      const x = barCenterX(i);
      const y = barY(v);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const deltaText =
    deltaPercent === null
      ? null
      : deltaPercent >= 0
        ? fmt(t.finance.trendDeltaUp, { pct: deltaPercent })
        : fmt(t.finance.trendDeltaDown, { pct: deltaPercent });

  // Show a label at least every LABEL_EVERY bars, fewer (bigger step) once there are many bars.
  const labelStep = Math.max(LABEL_EVERY, Math.ceil(n / 6));

  return (
    <div className="relative rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-muted">{title}</h3>
        <span className="text-lg font-semibold tabular-nums text-ink">{vnd(currentValue)}</span>
      </div>
      {deltaText && (
        <p className="mt-0.5 text-xs tabular-nums" style={{ color }}>
          {deltaText}
        </p>
      )}

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          width="100%"
          height={120}
          preserveAspectRatio="none"
          role="img"
          aria-label={title}
        >
          {data.map((d, i) => {
            const h = Math.max(0, barHeight(d.value));
            const x = i * slotWidth + barOffset;
            const y = barY(d.value);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={BAR_RADIUS}
                ry={BAR_RADIUS}
                fill={color}
                opacity={hovered === null || hovered === i ? 1 : 0.55}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              />
            );
          })}
          {n > 1 && <path d={trendPath} fill="none" stroke={color} strokeWidth={0.6} strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />}
        </svg>

        {hovered !== null && data[hovered] && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-pop"
            style={{
              left: `${((hovered + 0.5) / n) * 100}%`,
              top: 0,
            }}
          >
            <div className="font-medium text-ink">{data[hovered].label}</div>
            <div className="tabular-nums text-muted">{vnd(data[hovered].value)}</div>
          </div>
        )}

        <div className="mt-1 flex text-[10px] text-muted">
          {data.map((d, i) => (
            <div key={i} style={{ width: `${100 / n}%` }} className="text-center">
              {i % labelStep === 0 ? d.label : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
