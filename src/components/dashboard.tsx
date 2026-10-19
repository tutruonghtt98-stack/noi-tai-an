import Link from "next/link";
import { ArrowUpRight, Check, Clock } from "lucide-react";
import type { Dict } from "@/lib/i18n/vi";
import { dayOfWeek, monthBounds, rangeISO, type ISODate } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { colorVar, softVar } from "@/lib/colors";
import type { TaskView } from "@/lib/queries";

export function StatCard({
  label,
  value,
  note,
  tone = "muted",
  href,
}: {
  label: string;
  value: React.ReactNode;
  note: string;
  tone?: "up" | "down" | "warn" | "muted";
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-44 flex-col rounded-[1.5rem] bg-surface-2 p-5 transition-colors hover:bg-surface-3"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink-2 shadow-card transition-transform group-hover:rotate-45">
          <ArrowUpRight className="size-4" aria-hidden />
        </span>
      </div>
      <span className="tabular mt-auto pt-6 text-[2.5rem] font-semibold leading-none tracking-tight">{value}</span>
      <span
        className={cn(
          "mt-3 text-sm",
          tone === "up" && "text-success",
          tone === "down" && "text-danger",
          tone === "warn" && "text-ochre-ink",
          tone === "muted" && "text-muted",
        )}
      >
        {note}
      </span>
    </Link>
  );
}

/** Lịch tháng tô màu theo điểm kỷ luật — tương ứng "Upcoming Schedule" của template. */
export function DisciplineCalendar({
  year,
  month,
  days,
  today,
  weekStartsOn,
  t,
  locale,
}: {
  year: number;
  month: number;
  days: Record<ISODate, number | null>;
  today: ISODate;
  weekStartsOn: number;
  t: Dict;
  locale: string;
}) {
  const { from, to } = monthBounds(year, month);
  const all = rangeISO(from, to);
  const lead = (dayOfWeek(from) - weekStartsOn + 7) % 7;
  const cells: (ISODate | null)[] = [...Array(lead).fill(null), ...all];
  while (cells.length % 7) cells.push(null);
  const order = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + weekStartsOn) % 7);
  const title = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );

  return (
    <>
      <div className="mb-4">
        <span className="rounded-full bg-surface-2 px-4 py-2 text-sm font-medium capitalize">{title}</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">
        {order.map((d) => (
          <span key={d} className="pb-1 text-sm font-medium text-ink-2">
            {t.habits.weekdays[d]}
          </span>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <span key={`e${i}`} className="aspect-square rounded-full bg-surface-2/60" aria-hidden />;
          const score = days[iso];
          const full = score != null && score >= 80;
          const partial = score != null && score > 0 && !full;
          return (
            <span
              key={iso}
              title={score != null ? `${iso}: ${score}/100` : iso}
              className={cn(
                "tabular grid aspect-square place-items-center rounded-full text-sm",
                full ? "bg-jade font-semibold text-[#1d1c1a]" : partial ? "bg-ochre font-semibold text-[#1d1c1a]" : "bg-surface-2 text-ink-2",
                iso > today && "text-muted",
                iso === today && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
              )}
            >
              {Number(iso.slice(8))}
            </span>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-jade" aria-hidden /> {t.dashboard.calendarFull}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-ochre" aria-hidden /> {t.dashboard.calendarPartial}
        </span>
      </div>
    </>
  );
}

/** Timeline giờ trong ngày — tương ứng "Daily Activity Planner" của template. */
export function DayTimeline({ tasks, nowHour, emptyText }: { tasks: TaskView[]; nowHour: number | null; emptyText: string }) {
  const scheduled = tasks
    .filter((t) => t.startTime)
    .map((t) => {
      const [h, m] = t.startTime!.split(":").map(Number) as [number, number];
      const start = h + m / 60;
      return { ...t, start, end: start + (t.estimateMin ?? 60) / 60 };
    })
    .sort((a, b) => a.start - b.start);

  const startHour = Math.min(8, ...scheduled.map((s) => Math.floor(s.start)));
  const endHour = Math.max(17, ...scheduled.map((s) => Math.ceil(s.end)));
  const span = endHour - startHour;
  const hours = Array.from({ length: span + 1 }, (_, i) => startHour + i);

  // Xếp làn để các khối không chồng nhau (tính cả độ rộng tối thiểu của thẻ ≈ 22% trục)
  const minSpan = span * 0.22;
  const laneEnds: number[] = [];
  const placed = scheduled.map((s) => {
    const visualEnd = Math.max(s.end, s.start + minSpan);
    let lane = laneEnds.findIndex((e) => e <= s.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = visualEnd;
    return { ...s, lane, width: visualEnd - s.start };
  });
  const lanes = Math.max(2, laneEnds.length);
  const palette = ["ochre", "mist", "jade", "rose"];
  const pos = (h: number) => `${((h - startHour) / span) * 100}%`;

  return (
    <div className="no-scrollbar -mx-[var(--pad)] overflow-x-auto px-[var(--pad)]">
      <div className="relative min-w-[880px]">
        <div className="relative h-8">
          {hours.map((h) => (
            <span key={h} className="tabular absolute -translate-x-1/2 text-sm text-ink-2 first:translate-x-0 last:-translate-x-full" style={{ left: pos(h) }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        <div className="relative" style={{ height: lanes * 88 + 16 }}>
          {hours.map((h) => (
            <span key={h} className="absolute inset-y-0 border-l border-dashed border-line" style={{ left: pos(h) }} aria-hidden />
          ))}
          {nowHour != null && nowHour >= startHour && nowHour <= endHour && (
            <span className="absolute inset-y-0 z-10 w-0.5 rounded-full bg-rose" style={{ left: pos(nowHour) }} aria-hidden>
              <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-rose" />
            </span>
          )}
          {placed.length === 0 && (
            <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted">{emptyText}</p>
          )}
          {placed.map((s, i) => {
            const c = s.goal?.color ?? palette[i % palette.length]!;
            return (
              <Link
                href="/today"
                key={s.id}
                className={cn(
                  "absolute flex h-[72px] min-w-[180px] items-center gap-3 overflow-hidden rounded-[1.25rem] px-4 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-card",
                  s.done && "opacity-60",
                )}
                style={{
                  left: pos(s.start),
                  width: `calc(${(s.width / span) * 100}% - 6px)`,
                  top: 8 + s.lane * 88,
                  background: softVar(c),
                }}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: colorVar(c) }}>
                  {s.done ? <Check className="size-4 text-[#1d1c1a]" strokeWidth={3} aria-hidden /> : <Clock className="size-4 text-[#1d1c1a]" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate font-medium", s.done && "line-through")}>{s.title}</span>
                  <span className="tabular block text-xs text-ink-2">
                    {s.startTime}
                    {s.estimateMin ? ` · ${s.estimateMin}′` : ""}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
