import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Star, Target } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { addDays, dayOfWeek, fromDbDate, hourInZone, startOfWeek, toDbDate, todayISO } from "@/lib/dates";
import { getDashboard } from "@/lib/queries";
import { getAccessibleBoards } from "@/lib/work-queries";
import { scoreBand } from "@/lib/stats";
import { FocusTimer } from "@/components/focus-timer";
import { HabitQuickList } from "@/components/habits";
import { DisciplineCalendar, StatCard } from "@/components/dashboard";
import { Planner } from "@/components/planner";
import { db } from "@/lib/db";
import { ProgressRing, ProgressBar } from "@/components/ui/progress-ring";
import { CountUp } from "@/components/ui/count-up";
import { SplitHeading } from "@/components/ui/split-heading";
import { SplitChars } from "@/components/ui/split-chars";
import { Empty } from "@/components/ui/empty";
import { EnableAlertsButton } from "@/components/alert-settings";
import { QuoteRotator } from "@/components/quote-rotator";
import { StaggerReveal } from "@/components/ui/stagger-reveal";
import { colorVar } from "@/lib/colors";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Tổng quan" };

function CardHead({ title, href, label }: { title: string; href?: string; label?: string }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 className="card-title text-[1.375rem]">
        <SplitChars text={title} />
      </h2>
      {href && (
        <Link href={href} className="icon-btn" aria-label={label ?? title}>
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const today = todayISO(user.timezone);
  const weekStart = startOfWeek(today, user.weekStartsOn);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [d, weekTasks, boards] = await Promise.all([
    getDashboard(user, today),
    db.task.findMany({
      where: { userId: user.id, date: { gte: toDbDate(weekStart), lte: toDbDate(weekDays[6]!) } },
      select: { id: true, title: true, date: true, startTime: true, estimateMin: true, status: true, goal: { select: { color: true } } },
      orderBy: { startTime: "asc" },
    }),
    getAccessibleBoards(user.id),
  ]);

  // Hạn chót bảng/thẻ Workspace rơi trong tuần hiện tại — hiện chung với lịch trình như một "việc" của ngày đó.
  const weekStartDate = weekDays[0]!;
  const weekEndDate = weekDays[6]!;
  const inWeek = (due: Date) => {
    const iso = due.toISOString().slice(0, 10);
    return iso >= weekStartDate && iso <= weekEndDate;
  };
  const boardDeadlines = boards
    .filter((b) => b.dueDate)
    .map((b) => ({ id: `board:${b.id}`, name: b.name, dueDate: b.dueDate!, href: `/workspace?b=${b.id}` }))
    .filter((b) => inWeek(b.dueDate));
  const cardDeadlines = boards
    .flatMap((b) => b.lists.flatMap((l) => l.cards.map((c) => ({ ...c, boardId: b.id }))))
    .filter((c) => c.dueDate)
    .map((c) => ({ id: `card:${c.id}`, name: c.title, dueDate: c.dueDate!, href: `/workspace?b=${c.boardId}&card=${c.id}` }))
    .filter((c) => inWeek(c.dueDate));

  const hour = hourInZone(user.timezone);
  const greet = hour < 11 ? t.greet.morning : hour < 18 ? t.greet.afternoon : t.greet.evening;
  const firstName = (user.name ?? "").trim().split(/\s+/).at(-1) || "";
  const band = scoreBand(d.score);
  const habitsLeft = d.dueHabits.filter((h) => !h.stats.doneToday).length;
  const prioritiesLeft = d.priorities.filter((p) => !p.done).length;
  const scoreTrend = Object.entries(d.calendar.days)
    .filter(([iso]) => iso <= today)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-14)
    .map(([, v]) => v ?? 0);

  return (
    <div className="grid grid-cols-1 gap-[var(--gap)] md:grid-cols-2 xl:grid-cols-12">
      <StaggerReveal slide={{ direction: "up", offset: 16 }} holdDelay={60}>
      <div className="flex flex-wrap items-end justify-between gap-4 xl:col-span-12">
        <div>
          <SplitHeading text={t.nav.dashboard} className="text-2xl font-semibold sm:text-[2rem]" />
          <p className="mt-2 text-ink-2">{t.dashboard.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge inline-flex items-center gap-2">
            <span className={cn("size-2 rounded-full", band === "high" ? "bg-success" : band === "mid" ? "bg-ochre" : "bg-muted")} aria-hidden />
            {t.dashboard.disciplineToday}: {d.score}/100
          </span>
        </div>
      </div>
      {/* Lời chào + điểm kỷ luật */}
      <section className="card hero-glow flex flex-col md:col-span-2 xl:col-span-4" aria-label={t.greet.hello}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[1.75rem] font-semibold leading-tight">
              <SplitChars text={t.greet.hello} />
            </p>
            <h1 className="text-[1.75rem] font-semibold leading-tight">
              <SplitChars text={greet} delay={0.1} />
              {firstName && <SplitChars text={`, ${firstName}`} className="text-muted" delay={0.1} />}
            </h1>
          </div>
          <ProgressRing value={d.score / 100} size={76} stroke={8} label={`${t.dashboard.disciplineToday}: ${d.score}/100`}>
            <span className="tabular text-lg font-semibold">{d.score}</span>
          </ProgressRing>
        </div>
        <QuoteRotator />
        <p className="mt-1 text-sm font-medium">
          {t.dashboard.disciplineToday}:{" "}
          <span className={cn(band === "high" ? "text-success" : band === "mid" ? "text-ochre-ink" : "text-muted")}>
            {band === "high" ? t.dashboard.scoreHigh : band === "mid" ? t.dashboard.scoreMid : t.dashboard.scoreLow}
          </span>
        </p>
        <div className="mt-auto flex flex-wrap gap-2.5 pt-8">
          <span className="chip">
            <span className="chip-num tabular">{prioritiesLeft}</span> {t.dashboard.priorities}
          </span>
          <Link href="/habits" className="chip hover:bg-surface-3">
            <span className="chip-num tabular">{habitsLeft}</span> {t.dashboard.habitsLeft}
          </Link>
        </div>
      </section>

      {/* Lịch kỷ luật */}
      <section className="card xl:col-span-4" aria-labelledby="cal">
        <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
          <h2 id="cal" className="card-title text-[1.375rem]">
            <SplitChars text={t.dashboard.calendar} />
          </h2>
          <Link href="/habits" className="btn btn-soft btn-sm">
            {t.common.seeAll}
          </Link>
        </div>
        <DisciplineCalendar
          year={d.calendar.year}
          month={d.calendar.month}
          days={d.calendar.days}
          today={today}
          weekStartsOn={user.weekStartsOn}
          t={t}
          locale={locale}
        />
      </section>

      {/* 4 chỉ số */}
      <section className="card grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-4 xl:col-span-4" aria-label="Stats">
        <StatCard
          href="/goals"
          label={t.dashboard.activeGoals}
          value={<CountUp value={d.activeGoals.length} />}
          note={fmt(t.dashboard.completedThisMonth, { n: d.completedThisMonth })}
          tone={d.completedThisMonth > 0 ? "up" : "muted"}
          featured
          spark={scoreTrend}
        />
        <StatCard
          href="/goals"
          label={t.dashboard.avgProgress}
          value={<CountUp value={Math.round(d.avgProgress * 100)} suffix="%" />}
          note={t.dashboard.acrossGoals}
          spark={scoreTrend}
        />
        <StatCard
          href="/habits"
          label={t.dashboard.bestStreak}
          value={<CountUp value={d.bestStreak} />}
          note={t.dashboard.streakDays}
          tone={d.bestStreak >= 7 ? "up" : "warn"}
          spark={scoreTrend}
        />
        <StatCard
          href="/dashboard"
          label={t.dashboard.focusToday}
          value={
            <>
              <CountUp value={d.day.focusMinutes} />
              <span className="ml-1 text-lg font-medium text-muted">{t.common.min}</span>
            </>
          }
          note={fmt(t.dashboard.ofGoal, { n: user.dailyFocusGoal })}
          tone={d.day.focusMinutes >= user.dailyFocusGoal ? "up" : "warn"}
          spark={scoreTrend}
        />
      </section>

      {/* Timeline */}
      <section className="card min-w-0 md:col-span-2 xl:col-span-12" aria-labelledby="planner">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-line pb-4">
          <h2 id="planner" className="card-title text-[1.375rem]">
            <SplitChars text={t.dashboard.planner} />
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <EnableAlertsButton />
          </div>
        </div>
        <Planner
          today={today}
          timezone={user.timezone}
          weekDays={weekDays}
          weekdayLabels={weekDays.map((x) => t.habits.weekdays[dayOfWeek(x)]!)}
          tasks={[
            ...weekTasks.map((x) => ({
              id: x.id,
              title: x.title,
              date: fromDbDate(x.date!),
              startTime: x.startTime,
              estimateMin: x.estimateMin,
              done: x.status === "DONE",
              color: x.goal?.color ?? null,
            })),
            ...boardDeadlines.map((b) => ({
              id: b.id,
              title: b.name,
              date: b.dueDate.toISOString().slice(0, 10),
              startTime: b.dueDate.toISOString().slice(11, 16),
              estimateMin: 90,
              done: false,
              color: "rose",
              href: b.href,
            })),
            ...cardDeadlines.map((c) => ({
              id: c.id,
              title: c.name,
              date: c.dueDate.toISOString().slice(0, 10),
              startTime: c.dueDate.toISOString().slice(11, 16),
              estimateMin: 90,
              done: false,
              color: "mist",
              href: c.href,
            })),
          ]}
        />
      </section>

      {/* Phiên tập trung */}
      <section className="card flex flex-col xl:col-span-4" aria-label={t.focus.title}>
        <CardHead title={t.focus.title} />
        <div className="flex flex-1 items-center justify-center">
          <FocusTimer
            compact
            focusMinutes={user.focusMinutes}
            breakMinutes={user.breakMinutes}
            tasks={d.day.tasks.filter((x) => !x.done).map((x) => ({ id: x.id, title: x.title }))}
            stats={{ count: d.day.focusCount, minutes: d.day.focusMinutes }}
          />
        </div>
      </section>

      {/* Top 3 */}
      <section className="card xl:col-span-4" aria-labelledby="top3">
        <CardHead title={t.dashboard.top3} />
        {d.priorities.length === 0 ? (
          <Empty icon={Star} text={t.dashboard.top3Empty} />
        ) : (
          <ol className="space-y-2">
            {d.priorities.map((p, i) => (
              <li key={p.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface-2 px-3">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold", p.done ? "bg-ink text-bg" : "bg-accent-soft text-accent-ink")}>
                  {i + 1}
                </span>
                <span className={cn("min-w-0 flex-1 truncate font-medium", p.done && "text-muted line-through")}>{p.title}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Thói quen */}
      <section className="card xl:col-span-4" aria-labelledby="habits-today">
        <CardHead title={t.dashboard.habitsToday} href="/habits" />
        <HabitQuickList habits={d.dueHabits} today={today} />
      </section>

      {/* Tiến độ mục tiêu */}
      <section className="card md:col-span-2 xl:col-span-12" aria-labelledby="goals-progress">
        <CardHead title={t.dashboard.goalsProgress} href="/goals" />
        {d.activeGoals.length === 0 ? (
          <Empty icon={Target} text={t.dashboard.goalsEmpty}>
            <Link href="/goals" className="btn btn-primary btn-sm">
              {t.goals.new}
            </Link>
          </Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
            {d.activeGoals.slice(0, 9).map((g) => (
              <li key={g.id}>
                <Link href={`/goals/${g.id}`} className="group block rounded-xl">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium group-hover:underline group-hover:underline-offset-4">{g.title}</span>
                    <span className="tabular shrink-0 text-sm font-semibold">{Math.round(g.progress * 100)}%</span>
                  </div>
                  <ProgressBar value={g.progress} color={colorVar(g.color)} label={g.title} />
                  <span className="mt-1.5 block text-xs text-muted">{t.goals.horizon[g.horizon]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      </StaggerReveal>
    </div>
  );
}
