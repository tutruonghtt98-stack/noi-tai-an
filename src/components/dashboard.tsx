import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Dict } from "@/lib/i18n/vi";
import { dayOfWeek, monthBounds, rangeISO, type ISODate } from "@/lib/dates";
import { cn } from "@/lib/cn";

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
