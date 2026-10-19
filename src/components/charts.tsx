"use client";
import { useState } from "react";
import { Table2, ChartColumn } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

export type Point = { key: string; label: string; value: number | null };

/** Khung thẻ biểu đồ + nút chuyển sang bảng số liệu (truy cập không phụ thuộc màu). */
export function ChartCard({
  title,
  subtitle,
  points,
  suffix = "",
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  points?: Point[];
  suffix?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const [table, setTable] = useState(false);
  const format = (v: number) => `${v}${suffix}`;
  return (
    <section className={cn("card min-w-0", className)} aria-label={title}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="card-title">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {points && (
          <button
            type="button"
            className="icon-btn icon-btn-plain"
            onClick={() => setTable((v) => !v)}
            aria-pressed={table}
            aria-label={table ? t.analytics.showChart : t.analytics.showTable}
            title={table ? t.analytics.showChart : t.analytics.showTable}
          >
            {table ? <ChartColumn className="size-4" aria-hidden /> : <Table2 className="size-4" aria-hidden />}
          </button>
        )}
      </div>
      {table && points ? (
        <div className="max-h-80 overflow-auto rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-left text-ink-2">
              <tr>
                <th className="px-4 py-2 font-medium">{t.analytics.date}</th>
                <th className="px-4 py-2 text-right font-medium">{title}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key} className="border-t border-line">
                  <td className="px-4 py-2">{p.label}</td>
                  <td className="tabular px-4 py-2 text-right">{p.value == null ? "—" : format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function Tooltip({ label, value, left }: { label: string; value: string; left: number }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-xs text-bg shadow-pop"
      style={{ left: `${left}%`, transform: `translate(${left > 80 ? "-100%" : left < 20 ? "0" : "-50%"}, -100%)` }}
    >
      <div className="text-bg/70">{label}</div>
      <div className="tabular text-sm font-semibold">{value}</div>
    </div>
  );
}

/** Biểu đồ cột một chuỗi (độ lớn). */
export function ColumnChart({
  points,
  color = "var(--chart-1)",
  suffix = "",
  height = 200,
}: {
  points: Point[];
  color?: string;
  suffix?: string;
  height?: number;
}) {
  const format = (v: number) => `${v}${suffix}`;
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...points.map((p) => p.value ?? 0)));
  const ticks = [max, max / 2, 0];
  const dense = points.length > 31;
  const labelEvery = points.length <= 10 ? 1 : points.length <= 31 ? 5 : 15;

  return (
    <div className="flex gap-2">
      <div className="tabular flex flex-col justify-between pb-6 text-right text-xs text-muted" style={{ height }} aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
            {t}
          </span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="relative" style={{ height: height - 24 }} onMouseLeave={() => setHover(null)}>
          {ticks.map((t, i) => (
            <span key={t} aria-hidden className="absolute inset-x-0 border-t border-line" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
          ))}
          <div className={cn("absolute inset-0 flex items-end", dense ? "gap-px" : "gap-[2px] sm:gap-1")}>
            {points.map((p, i) => {
              const h = p.value ? Math.max(2, (p.value / max) * 100) : 0;
              return (
                <div
                  key={p.key}
                  className="relative flex h-full flex-1 items-end"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${p.label}: ${p.value == null ? "—" : format(p.value)}`}
                >
                  <span
                    className="block w-full rounded-t-[4px] transition-[height,opacity] duration-500"
                    style={{ height: `${h}%`, background: color, opacity: hover == null || hover === i ? 1 : 0.45 }}
                  />
                </div>
              );
            })}
          </div>
          {hover != null && points[hover] && (
            <Tooltip
              label={points[hover].label}
              value={points[hover].value == null ? "—" : format(points[hover].value!)}
              left={((hover + 0.5) / points.length) * 100}
            />
          )}
        </div>
        <div className="mt-2 flex h-4 text-[0.6875rem] text-muted" aria-hidden>
          {points.map((p, i) => (
            <span key={p.key} className="flex-1 overflow-visible whitespace-nowrap text-center">
              {i % labelEvery === 0 ? p.label.split(" ").at(-1) : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Biểu đồ đường 0–100 (điểm kỷ luật), ngày không có dữ liệu làm đứt nét. */
export function ScoreLine({ points, color = "var(--chart-2)", height = 200 }: { points: Point[]; color?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = 100;
  const n = points.length;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - v;

  // Tách thành các đoạn liền nhau
  const segs: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.value == null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push({ i, v: p.value });
  });
  if (cur.length) segs.push(cur);

  const hv = hover != null ? points[hover] : null;

  return (
    <div className="flex gap-2">
      <div className="tabular flex flex-col justify-between pb-6 text-right text-xs text-muted" style={{ height }} aria-hidden>
        <span>100</span>
        <span>50</span>
        <span>0</span>
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="relative" style={{ height: height - 24 }} onMouseLeave={() => setHover(null)}>
          {[0, 50, 100].map((t) => (
            <span key={t} aria-hidden className="absolute inset-x-0 border-t border-line" style={{ top: `${100 - t}%` }} />
          ))}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {segs.map((s, k) => (
              <g key={k}>
                <path
                  d={`M${x(s[0]!.i)},${H} ${s.map((p) => `L${x(p.i)},${y(p.v)}`).join(" ")} L${x(s.at(-1)!.i)},${H} Z`}
                  fill={color}
                  opacity={0.12}
                />
                <path
                  d={s.map((p, j) => `${j ? "L" : "M"}${x(p.i)},${y(p.v)}`).join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            ))}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--muted)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />}
          </svg>
          {hv?.value != null && (
            <span
              aria-hidden
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
              style={{ left: `${(x(hover!) / W) * 100}%`, top: `${100 - hv.value}%`, background: color }}
            />
          )}
          <div className="absolute inset-0 flex">
            {points.map((p, i) => (
              <div
                key={p.key}
                className="h-full flex-1"
                tabIndex={0}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${p.label}: ${p.value ?? "—"}`}
              />
            ))}
          </div>
          {hv && <Tooltip label={hv.label} value={hv.value == null ? "—" : `${hv.value}/100`} left={(x(hover!) / W) * 100} />}
        </div>
        <div className="mt-2 flex h-4 justify-between text-[0.6875rem] text-muted" aria-hidden>
          <span>{points[0]?.label}</span>
          <span>{points.at(-1)?.label}</span>
        </div>
      </div>
    </div>
  );
}

/** Heatmap thói quen: hàng = thói quen, cột = ngày. Thang tuần tự một màu. */
export function HabitHeatmap({
  rows,
  days,
}: {
  rows: { id: string; name: string; cells: (number | null)[] }[]; // 0..1, null = không có lịch
  days: { key: string; label: string }[];
}) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const cellBg = (v: number | null) =>
    v == null ? "transparent" : v === 0 ? "var(--surface-2)" : `color-mix(in oklab, var(--chart-2) ${Math.round(35 + v * 65)}%, var(--surface))`;
  const h = hover ? rows[hover.r] : null;
  return (
    <div className="no-scrollbar overflow-x-auto">
      <div className="relative min-w-fit" onMouseLeave={() => setHover(null)}>
        {rows.map((row, r) => (
          <div key={row.id} className="flex items-center gap-3 py-[3px]">
            <span className="w-32 shrink-0 truncate text-sm sm:w-40" title={row.name}>
              {row.name}
            </span>
            <div className="flex gap-[3px]">
              {row.cells.map((v, c) => (
                <span
                  key={days[c]!.key}
                  onMouseEnter={() => setHover({ r, c })}
                  className={cn("size-4 rounded-[4px] sm:size-[18px]", v == null && "border border-dashed border-line")}
                  style={{ background: cellBg(v) }}
                  aria-label={`${row.name} · ${days[c]!.label}: ${v == null ? "—" : `${Math.round(v * 100)}%`}`}
                  role="img"
                />
              ))}
            </div>
          </div>
        ))}
        {h && hover && (
          <div className="pointer-events-none absolute right-0 top-0 rounded-xl bg-ink px-3 py-2 text-xs text-bg shadow-pop">
            <div className="text-bg/70">{days[hover.c]!.label}</div>
            <div className="font-semibold">
              {h.name}: {h.cells[hover.c] == null ? "—" : `${Math.round(h.cells[hover.c]! * 100)}%`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Danh sách thanh ngang có nhãn trực tiếp (tỷ lệ theo thói quen / mục tiêu). */
export function BarList({ items, color = "var(--chart-2)" }: { items: { id: string; label: string; value: number; note?: string }[]; color?: string }) {
  return (
    <ul className="space-y-4">
      {items.map((it) => (
        <li key={it.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{it.label}</span>
            <span className="tabular shrink-0 text-ink-2">
              {it.note && <span className="mr-2 text-muted">{it.note}</span>}
              {Math.round(it.value * 100)}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(it.value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={it.label}>
            <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(it.value > 0 ? 2 : 0, it.value * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
