"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, LocateFixed } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { colorVar, softVar } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { WorkCardTrigger } from "@/app/(app)/workspace/work-card-trigger";

export type PlannerTask = {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  estimateMin: number | null;
  done: boolean;
  color: string | null;
  /** Có thì khối lịch trình bấm được, điều hướng tới (vd: bảng Workspace liên quan). */
  href?: string;
  /** Có thì khối lịch trình bấm được, mở ngay popup Chi tiết thẻ (ưu tiên hơn href nếu cả 2 đều có). */
  cardId?: string;
};

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

  // Vị trí các khối việc hoàn toàn do transform tính tay — khối này không bao giờ được tự cuộn.
  // Trình duyệt vẫn coi nó là 1 "scroll container" (overflow-hidden) và tự cuộn khi focus quay lại
  // 1 khối việc bên trong sau khi đóng popup Chi tiết thẻ (CardModal là <dialog>, đóng xong trả
  // focus về đúng nút vừa bấm) — cuộn đó làm lệch cả dải giờ, trông như "mất hết việc".
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollLeft !== 0) el.scrollLeft = 0;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
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
            const boxClassName = cn(
              "absolute flex h-[68px] items-center gap-3 overflow-hidden rounded-[1.25rem] px-4 text-left",
              (p.done || past) && "opacity-55",
              (p.href || p.cardId) && "transition-transform hover:-translate-y-0.5 hover:shadow-card",
            );
            const boxStyle = { left: p.start * PX_PER_HOUR + 2, width: p.w - 6, top: 36 + p.lane * ROW, background: softVar(p.c) };
            const content = (
              <>
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
              </>
            );
            return p.cardId ? (
              <WorkCardTrigger key={p.id} cardId={p.cardId} className={boxClassName} style={boxStyle} title={`${p.startTime} · ${p.title}`}>
                {content}
              </WorkCardTrigger>
            ) : p.href ? (
              <Link key={p.id} href={p.href} className={boxClassName} style={boxStyle} title={`${p.startTime} · ${p.title}`}>
                {content}
              </Link>
            ) : (
              <div key={p.id} className={boxClassName} style={boxStyle} title={`${p.startTime} · ${p.title}`}>
                {content}
              </div>
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
        {unscheduled > 0 && <span className="text-sm text-muted">{fmt(t.timeline.unscheduled, { n: unscheduled })}</span>}
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
  const clip = useRef<HTMLDivElement>(null);
  const scheduled = tasks.filter((x) => x.startTime);
  const hours = Array.from({ length: 25 }, (_, h) => h);
  const center = Math.min(24, Math.max(0, (now ?? 12) + offset));
  const shift = VIEW_H / 2 - center * HOUR_PX;
  const hh = (v: number) => `${String(Math.floor(v) % 24).padStart(2, "0")}:${String(Math.floor((v % 1) * 60)).padStart(2, "0")}`;

  // Cùng lý do với DayTrack: vị trí ở đây do transform tính tay, khối này không bao giờ được tự
  // cuộn — trình duyệt vẫn có thể tự cuộn dọc khi focus quay lại 1 khối việc sau khi đóng popup.
  useEffect(() => {
    const el = clip.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop !== 0) el.scrollTop = 0;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div>
      <div className="no-scrollbar -mx-[var(--pad)] overflow-x-auto px-[var(--pad)]">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] border-b border-line pb-2">
            <span />
            {days.map((d, i) => {
              const isToday = d === today;
              return (
                <div key={d} className={cn("text-center", i > 0 && "border-l border-line")}>
                  <p className={cn("text-xs font-medium uppercase", isToday ? "text-accent-ink" : "text-muted")}>{labels[i]}</p>
                  <p
                    className={cn(
                      "tabular mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-lg font-semibold leading-none",
                      isToday ? "bg-accent-ink text-bg" : "",
                    )}
                  >
                    {Number(d.slice(8))}
                  </p>
                </div>
              );
            })}
          </div>

          <div ref={clip} className="relative overflow-hidden" style={{ height: VIEW_H }}>
            {/* Toàn bộ 24 giờ — trượt dọc để giờ hiện tại luôn nằm giữa */}
            <div
              className="absolute inset-x-0 top-0 grid grid-cols-[48px_repeat(7,minmax(0,1fr))] transition-transform duration-[1200ms] ease-linear motion-reduce:transition-none"
              style={{ height: 24 * HOUR_PX, transform: `translateY(${shift}px)` }}
            >
              <div className="relative">
                {hours.map((h) => (
                  <span key={h} className="tabular absolute right-2 -translate-y-1/2 text-xs text-muted" style={{ top: h * HOUR_PX }}>
                    {String(h % 24).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
              {days.map((d, dayIndex) => {
                // Việc trùng giờ trong cùng ngày được chia thành các "làn" đứng cạnh nhau, mỗi làn
                // chia đều bề rộng ngày (kiểu Google Calendar) thay vì chồng lệch (cascade) khó đọc.
                const dayTasks = scheduled
                  .filter((x) => x.date === d)
                  .map((x) => ({ ...x, start: toH(x.startTime!), dur: Math.max(0.5, (x.estimateMin ?? 60) / 60) }))
                  .sort((a, b) => a.start - b.start);
                const laned: ((typeof dayTasks)[number] & { lane: number; laneCount: number })[] = [];
                let gi = 0;
                while (gi < dayTasks.length) {
                  // Gom 1 "cụm" việc chồng giờ liên tiếp nhau (bắc cầu: A chồng B, B chồng C → cùng cụm).
                  let groupEnd = dayTasks[gi]!.start + dayTasks[gi]!.dur;
                  let gj = gi + 1;
                  while (gj < dayTasks.length && dayTasks[gj]!.start < groupEnd) {
                    groupEnd = Math.max(groupEnd, dayTasks[gj]!.start + dayTasks[gj]!.dur);
                    gj++;
                  }
                  const laneEnds: number[] = [];
                  const group = dayTasks.slice(gi, gj).map((x) => {
                    let lane = laneEnds.findIndex((e) => e <= x.start);
                    if (lane === -1) lane = laneEnds.length;
                    laneEnds[lane] = x.start + x.dur;
                    return { ...x, lane };
                  });
                  const laneCount = laneEnds.length;
                  for (const x of group) laned.push({ ...x, laneCount });
                  gi = gj;
                }
                return (
                  <div key={d} className={cn("relative bg-surface", dayIndex > 0 && "border-l border-line")}>
                    {hours.map((h) => (
                      <span key={h} className="absolute inset-x-0 border-t border-line/60" style={{ top: h * HOUR_PX }} aria-hidden />
                    ))}
                    {laned.map((x, i) => {
                      const c = x.color ?? PALETTE[i % PALETTE.length]!;
                      const past = now != null && (d < today || (d === today && x.start + x.dur < now));
                      const boxClassName = cn(
                        "absolute overflow-hidden rounded-[4px] px-1.5 py-1 text-left text-[0.6875rem] leading-tight text-white",
                        (x.done || past) && "opacity-55",
                        (x.href || x.cardId) && "hover:brightness-95",
                      );
                      const boxStyle = {
                        top: x.start * HOUR_PX + 1,
                        height: x.dur * HOUR_PX - 2,
                        left: `calc(${(x.lane / x.laneCount) * 100}% + ${x.lane === 0 ? 2 : 1}px)`,
                        width: `calc(${100 / x.laneCount}% - ${x.lane === 0 ? 4 : 3}px)`,
                        zIndex: x.lane + 1,
                        background: colorVar(c),
                      };
                      const content = (
                        <>
                          <span className={cn("block truncate font-semibold", x.done && "line-through")}>{x.title}</span>
                          <span className="tabular opacity-90">{x.startTime}</span>
                        </>
                      );
                      return x.cardId ? (
                        <WorkCardTrigger key={x.id} cardId={x.cardId} title={`${x.startTime} · ${x.title}`} className={boxClassName} style={boxStyle}>
                          {content}
                        </WorkCardTrigger>
                      ) : x.href ? (
                        <Link key={x.id} href={x.href} title={`${x.startTime} · ${x.title}`} className={boxClassName} style={boxStyle}>
                          {content}
                        </Link>
                      ) : (
                        <div key={x.id} title={`${x.startTime} · ${x.title}`} className={boxClassName} style={boxStyle}>
                          {content}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Vạch thời gian cố định ở giữa, chạy ngang qua cả tuần — kiểu Google Calendar: 1 chấm đỏ
                nhỏ ở mép trái + 1 đường kẻ đỏ mảnh chạy suốt chiều ngang. */}
            <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: VIEW_H / 2 }} aria-hidden title={now != null ? hh(center) : undefined}>
              <span className="absolute left-[44px] top-1/2 size-2 -translate-y-1/2 rounded-full bg-rose" />
              <span className="absolute left-[48px] right-0 h-px -translate-y-1/2 bg-rose" />
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
