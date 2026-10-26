"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, LocateFixed } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { colorVar, softVar } from "@/lib/colors";
import { cn } from "@/lib/cn";

export type PlannerTask = { id: string; title: string; date: string; startTime: string | null; estimateMin: number | null; done: boolean; color: string | null };

const PALETTE = ["ochre", "mist", "jade", "rose"];
const toH = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! + m! / 60;
};

/** Giờ hiện tại (dạng thập phân) theo múi giờ người dùng, cập nhật mỗi 20 giây. */
function useNow(tz: string) {
  const calc = () => {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date());
    const g = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
    return (g("hour") % 24) + g("minute") / 60 + g("second") / 3600;
  };
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(calc());
    const id = setInterval(() => setNow(calc()), 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tz]);
  return now;
}

export function Planner({
  today,
  timezone,
  weekDays,
  tasks,
  weekdayLabels,
}: {
  today: string;
  timezone: string;
  weekDays: string[]; // 7 ngày ISO của tuần hiện tại
  tasks: PlannerTask[]; // việc trong tuần
  weekdayLabels: string[]; // nhãn ngắn theo thứ tự weekDays
}) {
  const { t } = useI18n();
  const [view, setView] = useState<"day" | "week">("day");
  useEffect(() => {
    try {
      const v = localStorage.getItem("nta:planner-view");
      if (v === "week" || v === "day") setView(v);
    } catch {}
  }, []);
  const change = (v: "day" | "week") => {
    setView(v);
    try {
      localStorage.setItem("nta:planner-view", v);
    } catch {}
  };
  const now = useNow(timezone);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="segmented" role="tablist" aria-label={t.dashboard.planner}>
          {(["day", "week"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} aria-pressed={view === v} onClick={() => change(v)}>
              {v === "day" ? t.timeline.day : t.timeline.week}
            </button>
          ))}
        </div>
      </div>
      {view === "day" ? (
        <DayTrack tasks={tasks.filter((x) => x.date === today)} now={now} />
      ) : (
        <WeekGrid tasks={tasks} days={weekDays} labels={weekdayLabels} today={today} now={now} />
      )}
    </div>
  );
}

// ---------- Ngày: vạch "bây giờ" cố định ở giữa, công việc trôi theo giờ thực ----------

const PX_PER_HOUR = 150;
const ROW = 84;

function DayTrack({ tasks, now }: { tasks: PlannerTask[]; now: number | null }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [offset, setOffset] = useState(0); // lệch so với "bây giờ" (giờ)

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const placed = useMemo(() => {
    const minSpan = 180 / PX_PER_HOUR; // khối tối thiểu 180px
    const laneEnds: number[] = [];
    return tasks
      .filter((x) => x.startTime)
      .map((x) => ({ ...x, start: toH(x.startTime!), end: toH(x.startTime!) + (x.estimateMin ?? 60) / 60 }))
      .sort((a, b) => a.start - b.start)
      .map((x, i) => {
        const vEnd = Math.max(x.end, x.start + minSpan);
        let lane = laneEnds.findIndex((e) => e <= x.start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = vEnd;
        return { ...x, lane, w: (vEnd - x.start) * PX_PER_HOUR, c: x.color ?? PALETTE[i % PALETTE.length]! };
      });
  }, [tasks]);
  const lanes = Math.max(2, ...placed.map((p) => p.lane + 1));
  const center = (now ?? 12) + offset;
  const shift = width / 2 - center * PX_PER_HOUR;
  const unscheduled = tasks.filter((x) => !x.startTime && !x.done).length;

  return (
    <div>
      <div ref={box} className="relative overflow-hidden rounded-2xl" style={{ height: 32 + lanes * ROW + 12 }} aria-label={t.dashboard.planner}>
        {/* Đường ray chứa cả 24 giờ — trượt ngang theo thời gian */}
        <div
          className="absolute inset-y-0 left-0 transition-transform duration-[1200ms] ease-linear motion-reduce:transition-none"
          style={{ width: 24 * PX_PER_HOUR, transform: `translateX(${shift}px)` }}
        >
          {Array.from({ length: 25 }, (_, h) => (
            <div key={h} className="absolute inset-y-0" style={{ left: h * PX_PER_HOUR }} aria-hidden>
              <span className="tabular absolute top-1 -translate-x-1/2 text-sm text-ink-2">{String(h % 24).padStart(2, "0")}:00</span>
              <span className="absolute bottom-0 top-8 border-l border-dashed border-line" />
            </div>
          ))}
          {placed.map((p) => {
            const past = now != null && p.end < now;
            return (
              <Link
                href="/today"
                key={p.id}
                className={cn(
                  "absolute flex h-[68px] items-center gap-3 overflow-hidden rounded-[1.25rem] px-4 transition-[box-shadow,opacity] hover:shadow-card",
                  (p.done || past) && "opacity-55",
                )}
                style={{ left: p.start * PX_PER_HOUR + 2, width: p.w - 6, top: 36 + p.lane * ROW, background: softVar(p.c) }}
                title={`${p.startTime} · ${p.title}`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: colorVar(p.c) }}>
                  {p.done ? <Check className="size-4 text-[#1d1c1a]" strokeWidth={3} aria-hidden /> : <Clock className="size-4 text-[#1d1c1a]" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate font-medium", p.done && "line-through")}>{p.title}</span>
                  <span className="tabular block text-xs text-ink-2">
                    {p.startTime}
                    {p.estimateMin ? ` · ${p.estimateMin}′` : ""}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        {/* Vạch thời gian cố định ở giữa */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 -translate-x-1/2" aria-hidden>
          <span className="tabular absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose px-2 py-0.5 text-xs font-semibold text-[#1d1c1a] shadow-card">
            {offset === 0 ? t.timeline.now : ""}
            {now != null && `${offset === 0 ? " · " : ""}${String(Math.floor(center) % 24).padStart(2, "0")}:${String(Math.floor((center % 1) * 60)).padStart(2, "0")}`}
          </span>
          <span className="absolute bottom-0 left-1/2 top-6 w-0.5 -translate-x-1/2 rounded-full bg-rose" />
        </div>
        {/* Làm mờ hai mép */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-surface to-transparent" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent" aria-hidden />
        {placed.length === 0 && <p className="absolute inset-x-0 bottom-6 z-10 px-6 text-center text-sm text-muted">{t.dashboard.plannerEmpty}</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" className="icon-btn size-9" onClick={() => setOffset((o) => o - 2)} aria-label="−2h">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" className="icon-btn size-9" onClick={() => setOffset((o) => o + 2)} aria-label="+2h">
            <ChevronRight className="size-4" aria-hidden />
          </button>
          {offset !== 0 && (
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setOffset(0)}>
              <LocateFixed className="size-4" aria-hidden /> {t.timeline.jumpNow}
            </button>
          )}
        </div>
        {unscheduled > 0 && (
          <Link href="/today" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
            {fmt(t.timeline.unscheduled, { n: unscheduled })} →
          </Link>
        )}
      </div>
    </div>
  );
}

// ---------- Tuần: 7 cột ngày, vạch "bây giờ" cố định ở giữa, lịch trôi dọc theo giờ thực ----------

const HOUR_PX = 44;
const VIEW_H = 440;

function WeekGrid({ tasks, days, labels, today, now }: { tasks: PlannerTask[]; days: string[]; labels: string[]; today: string; now: number | null }) {
  const { t } = useI18n();
  const [offset, setOffset] = useState(0); // lệch so với "bây giờ" (giờ)
  const scheduled = tasks.filter((x) => x.startTime);
  const hours = Array.from({ length: 25 }, (_, h) => h);
  const center = Math.min(24, Math.max(0, (now ?? 12) + offset));
  const shift = VIEW_H / 2 - center * HOUR_PX;
  const hh = (v: number) => `${String(Math.floor(v) % 24).padStart(2, "0")}:${String(Math.floor((v % 1) * 60)).padStart(2, "0")}`;

  return (
    <div>
      <div className="no-scrollbar -mx-[var(--pad)] overflow-x-auto px-[var(--pad)]">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-1.5 pb-2">
            <span />
            {days.map((d, i) => {
              const n = tasks.filter((x) => x.date === d && !x.startTime && !x.done).length;
              return (
                <div key={d} className={cn("rounded-xl px-2 py-1.5 text-center", d === today ? "bg-ink text-bg" : "bg-surface-2")}>
                  <p className="text-xs font-medium opacity-80">{labels[i]}</p>
                  <p className="tabular text-lg font-semibold leading-tight">{Number(d.slice(8))}</p>
                  {n > 0 && <p className="text-[0.6875rem] opacity-70">+{n}</p>}
                </div>
              );
            })}
          </div>

          <div className="relative overflow-hidden rounded-xl" style={{ height: VIEW_H }}>
            {/* Toàn bộ 24 giờ — trượt dọc để giờ hiện tại luôn nằm giữa */}
            <div
              className="absolute inset-x-0 top-0 grid grid-cols-[48px_repeat(7,minmax(0,1fr))] gap-1.5 transition-transform duration-[1200ms] ease-linear motion-reduce:transition-none"
              style={{ height: 24 * HOUR_PX, transform: `translateY(${shift}px)` }}
            >
              <div className="relative">
                {hours.map((h) => (
                  <span key={h} className="tabular absolute right-1 -translate-y-1/2 text-xs text-muted" style={{ top: h * HOUR_PX }}>
                    {String(h % 24).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
              {days.map((d) => (
                <div key={d} className={cn("relative rounded-xl", d === today ? "bg-accent-soft/40" : "bg-surface-2/50")}>
                  {hours.map((h) => (
                    <span key={h} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: h * HOUR_PX }} aria-hidden />
                  ))}
                  {scheduled
                    .filter((x) => x.date === d)
                    .map((x, i) => {
                      const s = toH(x.startTime!);
                      const dur = Math.max(0.5, (x.estimateMin ?? 60) / 60);
                      const c = x.color ?? PALETTE[i % PALETTE.length]!;
                      const past = now != null && (d < today || (d === today && s + dur < now));
                      return (
                        <Link
                          href={`/today?date=${d}`}
                          key={x.id}
                          title={`${x.startTime} · ${x.title}`}
                          className={cn(
                            "absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-[0.6875rem] leading-tight transition-shadow hover:shadow-card",
                            (x.done || past) && "opacity-55",
                          )}
                          style={{ top: s * HOUR_PX + 1, height: dur * HOUR_PX - 2, background: softVar(c), borderColor: colorVar(c) }}
                        >
                          <span className={cn("block truncate font-semibold", x.done && "line-through")}>{x.title}</span>
                          <span className="tabular text-ink-2">{x.startTime}</span>
                        </Link>
                      );
                    })}
                </div>
              ))}
            </div>

            {/* Vạch thời gian cố định ở giữa, chạy ngang qua cả tuần */}
            <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: VIEW_H / 2 }} aria-hidden>
              <span className="absolute left-[54px] right-0 h-0.5 -translate-y-1/2 bg-rose/50" />
              {(() => {
                const idx = days.indexOf(today);
                if (idx < 0 || offset !== 0) return null;
                return (
                  <span
                    className="absolute h-[3px] -translate-y-1/2 rounded-full bg-rose"
                    style={{ left: `calc(54px + (100% - 54px - 6 * 6px) / 7 * ${idx} + ${idx} * 6px)`, width: `calc((100% - 54px - 6 * 6px) / 7)` }}
                  />
                );
              })()}
              <span className="tabular absolute left-0 -translate-y-1/2 whitespace-nowrap rounded-full bg-rose px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[#1d1c1a] shadow-card">
                {now != null ? hh(center) : "--:--"}
              </span>
            </div>
            {/* Làm mờ mép trên / dưới */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-surface to-transparent" aria-hidden />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface to-transparent" aria-hidden />
          </div>
          {scheduled.length === 0 && <p className="mt-3 text-center text-sm text-muted">{t.timeline.weekEmpty}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button type="button" className="icon-btn size-9" onClick={() => setOffset((o) => Math.max(-24, o - 2))} aria-label="−2h">
          <ChevronUp className="size-4" aria-hidden />
        </button>
        <button type="button" className="icon-btn size-9" onClick={() => setOffset((o) => Math.min(24, o + 2))} aria-label="+2h">
          <ChevronDown className="size-4" aria-hidden />
        </button>
        {offset !== 0 && (
          <button type="button" className="btn btn-soft btn-sm" onClick={() => setOffset(0)}>
            <LocateFixed className="size-4" aria-hidden /> {t.timeline.jumpNow}
          </button>
        )}
      </div>
    </div>
  );
}
