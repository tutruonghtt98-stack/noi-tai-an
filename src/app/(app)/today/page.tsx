import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { addDays, formatDate, isValidISO, todayISO } from "@/lib/dates";
import { getBacklog, getDay, getGoalOptions, getHabitsWithStats, getOverdue } from "@/lib/queries";
import { TaskBoard, PullList } from "@/components/tasks";
import { FocusTimer } from "@/components/focus-timer";
import { HabitQuickList } from "@/components/habits";
import { IntentionCard } from "./intention";

export const metadata: Metadata = { title: "Thực thi" };

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const today = todayISO(user.timezone);
  const sp = await searchParams;
  const date = isValidISO(sp.date) ? sp.date : today;
  const isToday = date === today;

  const [day, goals, habits, overdue, backlog] = await Promise.all([
    getDay(user, date),
    getGoalOptions(user),
    isToday ? getHabitsWithStats(user, today) : Promise.resolve([]),
    isToday ? getOverdue(user, today) : Promise.resolve([]),
    isToday ? getBacklog(user) : Promise.resolve([]),
  ]);

  const rel = date === today ? t.common.today : date === addDays(today, -1) ? t.common.yesterday : date === addDays(today, 1) ? t.common.tomorrow : null;
  const pull = [
    ...overdue.map((o) => ({ id: o.id, title: o.title, meta: [o.date?.toISOString().slice(0, 10), o.goal?.title].filter(Boolean).join(" · ") })),
    ...backlog.map((b) => ({ id: b.id, title: b.title, meta: b.goal?.title })),
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted">{t.today.title}</p>
          <h1 className="mt-1 text-3xl font-semibold first-letter:uppercase sm:text-[2.5rem]">
            {rel ?? formatDate(date, locale, { weekday: "long" })}
            <span className="ml-3 align-middle text-lg font-normal normal-case text-muted">
              {formatDate(date, locale, { weekday: rel ? "long" : undefined, day: "numeric", month: "long" })}
            </span>
          </h1>
        </div>
        <nav className="flex items-center gap-2" aria-label="Date">
          <Link href={`/today?date=${addDays(date, -1)}`} className="icon-btn bg-surface shadow-card" aria-label={t.common.prev}>
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          {!isToday && (
            <Link href="/today" className="btn btn-soft bg-surface shadow-card">
              {t.common.today}
            </Link>
          )}
          <Link href={`/today?date=${addDays(date, 1)}`} className="icon-btn bg-surface shadow-card" aria-label={t.common.next}>
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </nav>
      </div>

      <div className="grid grid-cols-1 gap-[var(--gap)] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-[var(--gap)]">
          <IntentionCard key={date} date={date} intention={day.plan?.intention ?? ""} energy={day.plan?.energy ?? null} />
          <TaskBoard date={date} tasks={day.tasks} goals={goals} />
        </div>

        <aside className="grid min-w-0 grid-cols-1 content-start gap-[var(--gap)]">
          {isToday && (
            <section className="card" aria-label={t.focus.title}>
              <FocusTimer
                focusMinutes={user.focusMinutes}
                breakMinutes={user.breakMinutes}
                tasks={day.tasks.filter((x) => !x.done).map((x) => ({ id: x.id, title: x.title }))}
                stats={{ count: day.focusCount, minutes: day.focusMinutes }}
              />
            </section>
          )}
          {isToday && (
            <section className="card" aria-labelledby="h-habits">
              <h2 id="h-habits" className="card-title mb-4">
                {t.dashboard.habitsToday}
              </h2>
              <HabitQuickList habits={habits.filter((h) => h.stats.scheduledToday)} today={today} />
            </section>
          )}
          {isToday && pull.length > 0 && (
            <section className="card" aria-labelledby="h-backlog">
              <h2 id="h-backlog" className="card-title mb-4">
                {t.today.backlog}
              </h2>
              <PullList items={pull} date={today} />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
