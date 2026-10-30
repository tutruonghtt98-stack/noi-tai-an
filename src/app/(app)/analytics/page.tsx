import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight, Lock, Minus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { addDays, formatDate, startOfWeek, todayISO, type ISODate } from "@/lib/dates";
import { getDailyStats, getGoals, getHabitsWithStats, summarize, type Summary } from "@/lib/queries";
import { limitsFor } from "@/lib/plan";
import { isScheduled } from "@/lib/stats";
import { PageHeader } from "@/components/page-header";
import { BarList, ChartCard, ColumnChart, HabitHeatmap, ScoreLine } from "@/components/charts";
import { CountUp } from "@/components/ui/count-up";
import { SegmentLinks } from "@/components/ui/segment-links";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Phân tích" };

const RANGES = ["week", "7", "30", "month", "90"] as const;
type Range = (typeof RANGES)[number];

function bounds(range: Range, today: ISODate, weekStartsOn: number): { from: ISODate; to: ISODate; prevFrom: ISODate; prevTo: ISODate } {
  if (range === "week") {
    const from = startOfWeek(today, weekStartsOn);
    return { from, to: today, prevFrom: addDays(from, -7), prevTo: addDays(today, -7) };
  }
  if (range === "month") {
    const from = `${today.slice(0, 7)}-01`;
    const prevStart = new Date(`${from}T00:00:00Z`);
    prevStart.setUTCMonth(prevStart.getUTCMonth() - 1);
    const pf = prevStart.toISOString().slice(0, 10);
    const dayIndex = Number(today.slice(8)) - 1;
    return { from, to: today, prevFrom: pf, prevTo: addDays(pf, dayIndex) };
  }
  const n = Number(range);
  const from = addDays(today, -(n - 1));
  return { from, to: today, prevFrom: addDays(from, -n), prevTo: addDays(from, -1) };
}

function Delta({ cur, prev, pct = false, label }: { cur: number; prev: number; pct?: boolean; label: string }) {
  const diff = pct ? Math.round((cur - prev) * 100) : prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-muted")}>
      <Icon className="size-4" aria-hidden />
      <span className="tabular">
        {diff > 0 ? "+" : ""}
        {diff}
        {pct ? " pt" : "%"}
      </span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const today = todayISO(user.timezone);
  const limit = limitsFor(user).analyticsDays;
  const sp = await searchParams;
  const allowed = (r: Range) => limit >= 30 || r === "7" || r === "week";
  const range: Range = RANGES.includes(sp.range as Range) && allowed(sp.range as Range) ? (sp.range as Range) : limit >= 30 ? "30" : "7";
  const b = bounds(range, today, user.weekStartsOn);

  const habits = await getHabitsWithStats(user, today, 200);
  const [days, prevDays, goals] = await Promise.all([
    getDailyStats(user, b.from, b.to, today, habits),
    getDailyStats(user, b.prevFrom, b.prevTo, today, habits),
    getGoals(user),
  ]);
  const cur = summarize(days);
  const prev = summarize(prevDays);

  const longLabel = (iso: ISODate) => formatDate(iso, locale, { weekday: "short", day: "numeric", month: "numeric" });
  const focusPoints = days.map((d) => ({ key: d.date, label: longLabel(d.date), value: d.focusMinutes }));
  const scorePoints = days.map((d) => ({ key: d.date, label: longLabel(d.date), value: d.score }));

  const heatRows = habits.map((h) => ({
    id: h.id,
    name: h.name,
    cells: days.map((d) =>
      d.date < h.createdAt || !isScheduled(h, d.date) ? null : Math.min(1, (h.logs[d.date] ?? 0) / h.targetPerDay),
    ),
  }));
  const habitRates = habits
    .map((h) => {
      const due = heatRows.find((r) => r.id === h.id)!.cells.filter((c) => c != null) as number[];
      return { id: h.id, label: h.name, value: due.length ? due.filter((c) => c >= 1).length / due.length : 0 };
    })
    .sort((a, b) => b.value - a.value);

  const activeOrDone = goals.filter((g) => g.status === "ACTIVE" || g.status === "COMPLETED");
  const goalItems = activeOrDone
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 8)
    .map((g) => ({ id: g.id, label: g.title, value: g.progress, note: t.goals.horizon[g.horizon] }));

  const rangeLabel: Record<Range, string> = {
    week: t.analytics.reportWeek,
    "7": t.analytics.r7,
    "30": t.analytics.r30,
    month: t.analytics.reportMonth,
    "90": t.analytics.r90,
  };
  const minutes = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}h${String(n % 60).padStart(2, "0")}` : `${n}′`);

  const reportRows: { label: string; cur: string; prev: string; c: number; p: number; pct?: boolean }[] = [
    { label: t.analytics.avgScore, cur: String(cur.avgScore), prev: String(prev.avgScore), c: cur.avgScore, p: prev.avgScore },
    { label: t.analytics.focusTotal, cur: minutes(cur.focusMinutes), prev: minutes(prev.focusMinutes), c: cur.focusMinutes, p: prev.focusMinutes },
    { label: t.analytics.sessions, cur: String(cur.sessions), prev: String(prev.sessions), c: cur.sessions, p: prev.sessions },
    { label: t.analytics.tasksDone, cur: String(cur.tasksDone), prev: String(prev.tasksDone), c: cur.tasksDone, p: prev.tasksDone },
    { label: t.analytics.habitRate, cur: pctStr(cur), prev: pctStr(prev), c: cur.habitRate, p: prev.habitRate, pct: true },
    {
      label: t.analytics.prioritiesRate,
      cur: `${Math.round(cur.prioritiesRate * 100)}%`,
      prev: `${Math.round(prev.prioritiesRate * 100)}%`,
      c: cur.prioritiesRate,
      p: prev.prioritiesRate,
      pct: true,
    },
  ];

  return (
    <>
      <PageHeader title={t.analytics.title} subtitle={t.analytics.subtitle} />

      <SegmentLinks
        ariaLabel={t.analytics.range}
        active={range}
        className="mb-2 max-w-full"
        items={RANGES.map((r) => ({
          value: r,
          href: allowed(r) ? `/analytics?range=${r}` : "/pricing",
          label: allowed(r) ? (
            rangeLabel[r]
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted" title={t.analytics.freeLimit}>
              <Lock className="size-3.5" aria-hidden /> {rangeLabel[r]}
            </span>
          ),
        }))}
      />
      <p className="mb-6 text-sm text-muted">
        {formatDate(b.from, locale, { day: "numeric", month: "long" })} – {formatDate(b.to, locale, { day: "numeric", month: "long", year: "numeric" })}
        {limit < 30 && <> · {t.analytics.freeLimit}</>}
      </p>

      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-2">
        {/* KPI */}
        <section className="card grid grid-cols-2 gap-3 p-3 sm:p-4 lg:col-span-2 lg:grid-cols-4" aria-label={t.analytics.title}>
          {[
            { l: t.analytics.avgScore, v: <CountUp value={cur.avgScore} />, d: <Delta cur={cur.avgScore} prev={prev.avgScore} label={t.analytics.vsPrev} /> },
            {
              l: t.analytics.focusTotal,
              v: <CountUp value={cur.focusMinutes} shape="minutes" />,
              d: <Delta cur={cur.focusMinutes} prev={prev.focusMinutes} label={t.analytics.vsPrev} />,
            },
            { l: t.analytics.tasksDone, v: <CountUp value={cur.tasksDone} />, d: <Delta cur={cur.tasksDone} prev={prev.tasksDone} label={t.analytics.vsPrev} /> },
            {
              l: t.analytics.habitRate,
              v: <CountUp value={cur.habitRate * 100} suffix="%" />,
              d: <Delta cur={cur.habitRate} prev={prev.habitRate} pct label={t.analytics.vsPrev} />,
            },
          ].map((k) => (
            <div key={k.l} className="rounded-[1.5rem] bg-surface-2 p-5">
              <p className="text-sm font-medium text-ink-2">{k.l}</p>
              <p className="tabular mt-4 text-4xl font-semibold tracking-tight">{k.v}</p>
              <div className="mt-2">{k.d}</div>
            </div>
          ))}
        </section>

        <ChartCard
          title={t.analytics.scoreTrend}
          subtitle={cur.best ? `${t.analytics.bestDay}: ${longLabel(cur.best.date)} · ${cur.best.score}/100` : undefined}
          points={scorePoints}
          suffix="/100"
        >
          {days.some((d) => d.score != null) ? <ScoreLine points={scorePoints} /> : <p className="py-16 text-center text-sm text-muted">{t.analytics.noData}</p>}
        </ChartCard>

        <ChartCard title={t.analytics.focusByDay} subtitle={`${minutes(cur.focusMinutes)} · ${cur.sessions} ${t.analytics.sessions.toLowerCase()}`} points={focusPoints} suffix={` ${t.common.minutes}`}>
          <ColumnChart points={focusPoints} suffix={` ${t.common.minutes}`} />
        </ChartCard>

        <ChartCard title={t.analytics.habitHistory} className="lg:col-span-2">
          {heatRows.length ? (
            <>
              <HabitHeatmap rows={heatRows} days={days.map((d) => ({ key: d.date, label: longLabel(d.date) }))} />
              <div className="mt-4 flex items-center gap-2 text-xs text-muted" aria-hidden>
                0%
                {[0, 0.34, 0.67, 1].map((v) => (
                  <span
                    key={v}
                    className="size-3.5 rounded-[4px]"
                    style={{ background: v === 0 ? "var(--surface-2)" : `color-mix(in oklab, var(--chart-2) ${Math.round(35 + v * 65)}%, var(--surface))` }}
                  />
                ))}
                100%
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-muted">{t.habits.empty}</p>
          )}
        </ChartCard>

        <ChartCard title={t.analytics.habitByHabit} subtitle={rangeLabel[range]}>
          {habitRates.length ? <BarList items={habitRates} /> : <p className="text-sm text-muted">{t.habits.empty}</p>}
        </ChartCard>

        <ChartCard
          title={t.analytics.goalCompletion}
          subtitle={fmt(t.analytics.goalsDone, { d: goals.filter((g) => g.status === "COMPLETED").length, t: activeOrDone.length })}
        >
          {goalItems.length ? <BarList items={goalItems} color="var(--chart-1)" /> : <p className="text-sm text-muted">{t.dashboard.goalsEmpty}</p>}
        </ChartCard>

        {/* Báo cáo so sánh kỳ */}
        <section className="card lg:col-span-2" aria-labelledby="report">
          <h2 id="report" className="card-title mb-4">
            {rangeLabel[range]} · {t.analytics.vsPrev}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-ink-2">
                <tr className="border-b border-line">
                  <th className="py-3 pr-4 font-medium">{t.analytics.metric}</th>
                  <th className="py-3 pr-4 text-right font-medium">{t.analytics.current}</th>
                  <th className="py-3 pr-4 text-right font-medium">{t.analytics.previous}</th>
                  <th className="py-3 text-right font-medium">{t.analytics.change}</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((r) => (
                  <tr key={r.label} className="border-b border-line last:border-0">
                    <td className="py-3 pr-4 font-medium">{r.label}</td>
                    <td className="tabular py-3 pr-4 text-right">{r.cur}</td>
                    <td className="tabular py-3 pr-4 text-right text-muted">{r.prev}</td>
                    <td className="py-3 text-right">
                      <Delta cur={r.c} prev={r.p} pct={r.pct} label="" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function pctStr(s: Summary) {
  return `${Math.round(s.habitRate * 100)}%`;
}
