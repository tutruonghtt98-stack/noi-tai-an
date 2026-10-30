import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { db } from "@/lib/db";
import { addDays, formatDate, fromDbDate, isValidISO, startOfWeek, toDbDate, todayISO } from "@/lib/dates";
import { getDailyStats, getHabitsWithStats, getRandomPublicJournals, summarize } from "@/lib/queries";
import { CAUSES, type Cause } from "@/lib/reflection";
import { PageHeader } from "@/components/page-header";
import { BarList } from "@/components/charts";
import { JournalList, WeeklyForm } from "./forms";
import { SegmentLinks } from "@/components/ui/segment-links";

export const metadata: Metadata = { title: "Suy ngẫm" };

type Tab = "daily" | "weekly" | "insights" | "random";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function ReflectionPage({ searchParams }: { searchParams: Promise<{ tab?: string; date?: string; week?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "weekly" || sp.tab === "insights" || sp.tab === "random" ? sp.tab : "daily";
  const today = todayISO(user.timezone);
  const minutes = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}h${String(n % 60).padStart(2, "0")}` : `${n}′`);

  const tabs: { id: Tab; label: string }[] = [
    { id: "daily", label: t.reflection.tabDaily },
    { id: "random", label: t.reflection.tabRandom },
    { id: "weekly", label: t.reflection.tabWeekly },
    { id: "insights", label: t.reflection.tabInsights },
  ];

  let body: React.ReactNode;

  if (tab === "daily") {
    const habits = await getHabitsWithStats(user, today, 60);
    const [entries, [day]] = await Promise.all([
      db.journalEntry.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, take: 90 }),
      getDailyStats(user, today, today, today, habits),
    ]);
    body = (
      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card" aria-labelledby="journal">
          <JournalList
            today={today}
            entries={entries.map((e) => ({
              id: e.id,
              date: fromDbDate(e.date),
              mood: e.mood,
              wins: e.wins,
              lessons: e.lessons,
              gratitude: e.gratitude,
              tomorrow: e.tomorrow,
              procrastination: e.procrastination as Cause[],
              procrastinationNote: e.procrastinationNote,
              isPublic: e.isPublic,
            }))}
          />
        </section>
        <aside className="card h-fit" aria-labelledby="day-sum">
          <h2 id="day-sum" className="card-title mb-4">
            {t.reflection.daySummary}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t.dashboard.disciplineToday} value={day?.score != null ? String(day.score) : "—"} />
            <Stat label={t.analytics.focusTotal} value={minutes(day?.focusMinutes ?? 0)} />
            <Stat label={t.analytics.tasksDone} value={String(day?.tasksDone ?? 0)} />
            <Stat label={t.dashboard.habitsToday} value={`${day?.habitsDone ?? 0}/${day?.habitsDue ?? 0}`} />
          </div>
        </aside>
      </div>
    );
  } else if (tab === "random") {
    const entries = await getRandomPublicJournals(user.id, 6);
    body = (
      <section className="card" aria-labelledby="random-journals">
        <div className="mb-5">
          <h2 id="random-journals" className="card-title">
            {t.reflection.randomTitle}
          </h2>
          <p className="mt-1 text-sm text-muted">{t.reflection.randomSubtitle}</p>
        </div>
        {entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{t.reflection.randomEmpty}</p>
        ) : (
          <>
            <ul className="grid gap-3 md:grid-cols-2">
              {entries.map((j) => (
                <li key={j.id} className="rounded-2xl bg-surface-2 p-4 text-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="badge">{t.reflection.randomAnonymous}</span>
                    {j.mood != null && <span className="tabular text-xs text-muted">{t.reflection.mood}: {j.mood}/5</span>}
                  </div>
                  <div className="space-y-2 text-ink-2">
                    {j.wins && (
                      <p>
                        <span className="font-medium text-ink">{t.reflection.wins}:</span> {j.wins}
                      </p>
                    )}
                    {j.lessons && (
                      <p>
                        <span className="font-medium text-ink">{t.reflection.lessons}:</span> {j.lessons}
                      </p>
                    )}
                    {j.gratitude && (
                      <p>
                        <span className="font-medium text-ink">{t.reflection.gratitude}:</span> {j.gratitude}
                      </p>
                    )}
                    {j.tomorrow && (
                      <p>
                        <span className="font-medium text-ink">{t.reflection.tomorrow}:</span> {j.tomorrow}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-center">
              <Link href={`/reflection?tab=random&r=${Math.random().toString(36).slice(2)}`} className="btn btn-soft btn-sm">
                {t.reflection.randomRefresh}
              </Link>
            </div>
          </>
        )}
      </section>
    );
  } else if (tab === "weekly") {
    const thisWeek = startOfWeek(today, user.weekStartsOn);
    const weekStart = isValidISO(sp.week) && sp.week <= thisWeek ? startOfWeek(sp.week, user.weekStartsOn) : thisWeek;
    const weekEnd = addDays(weekStart, 6);
    const habits = await getHabitsWithStats(user, today, 60);
    const [review, days, journals] = await Promise.all([
      db.weeklyReview.findUnique({ where: { userId_weekStart: { userId: user.id, weekStart: toDbDate(weekStart) } } }),
      getDailyStats(user, weekStart, weekEnd, today, habits),
      db.journalEntry.findMany({ where: { userId: user.id, date: { gte: toDbDate(weekStart), lte: toDbDate(weekEnd) } } }),
    ]);
    const s = summarize(days);
    const moods = journals.filter((j) => j.mood).map((j) => j.mood!);
    body = (
      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card" aria-labelledby="weekly">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 id="weekly" className="card-title">
              {fmt(t.reflection.weekOf, {
                from: formatDate(weekStart, locale, { day: "numeric", month: "numeric" }),
                to: formatDate(weekEnd, locale, { day: "numeric", month: "numeric" }),
              })}
            </h2>
            <div className="flex gap-2">
              <Link href={`/reflection?tab=weekly&week=${addDays(weekStart, -7)}`} className="icon-btn" aria-label={t.common.prev}>
                <ChevronLeft className="size-5" aria-hidden />
              </Link>
              {weekStart < thisWeek && (
                <Link href={`/reflection?tab=weekly&week=${addDays(weekStart, 7)}`} className="icon-btn" aria-label={t.common.next}>
                  <ChevronRight className="size-5" aria-hidden />
                </Link>
              )}
            </div>
          </div>
          <WeeklyForm
            key={weekStart}
            weekStart={weekStart}
            initial={{
              rating: review?.rating ?? null,
              highlights: review?.highlights ?? "",
              obstacles: review?.obstacles ?? "",
              rootCause: review?.rootCause ?? "",
              experiment: review?.experiment ?? "",
              nextFocus: review?.nextFocus ?? "",
            }}
          />
        </section>
        <aside className="card h-fit" aria-labelledby="week-sum">
          <h2 id="week-sum" className="card-title mb-4">
            {t.reflection.weekStats}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t.analytics.avgScore} value={String(s.avgScore)} />
            <Stat label={t.analytics.focusTotal} value={minutes(s.focusMinutes)} />
            <Stat label={t.analytics.tasksDone} value={String(s.tasksDone)} />
            <Stat label={t.analytics.habitRate} value={`${Math.round(s.habitRate * 100)}%`} />
            <Stat label={t.reflection.journalDays} value={`${journals.length}/7`} />
            <Stat label={t.reflection.avgMood} value={moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : "—"} />
          </div>
        </aside>
      </div>
    );
  } else {
    const from = addDays(today, -29);
    const [journals, reviews] = await Promise.all([
      db.journalEntry.findMany({ where: { userId: user.id, date: { gte: toDbDate(from) } }, orderBy: { date: "desc" } }),
      db.weeklyReview.findMany({ where: { userId: user.id, experiment: { not: null } }, orderBy: { weekStart: "desc" }, take: 4 }),
    ]);
    const counts = new Map<Cause, number>();
    for (const j of journals) for (const c of j.procrastination as Cause[]) counts.set(c, (counts.get(c) ?? 0) + 1);
    const total = journals.filter((j) => j.procrastination.length).length;
    const ranked = CAUSES.filter((c) => counts.get(c)).sort((a, b) => counts.get(b)! - counts.get(a)!);
    const top = ranked[0];
    const improvements = journals.filter((j) => j.tomorrow).slice(0, 5);

    body =
      ranked.length === 0 ? (
        <section className="card py-16 text-center text-sm text-muted">{t.reflection.insightsEmpty}</section>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-2">
          <section className="card" aria-labelledby="patterns">
            <h2 id="patterns" className="card-title mb-5">
              {t.reflection.insightsTitle}
            </h2>
            <BarList
              color="var(--chart-1)"
              items={ranked.map((c) => ({ id: c, label: t.reflection.causes[c], value: total ? counts.get(c)! / total : 0, note: fmt(t.reflection.times, { n: counts.get(c)! }) }))}
            />
          </section>
          <section className="card hero-glow" aria-labelledby="plan">
            <p className="text-sm font-medium text-muted">{t.reflection.topCause}</p>
            <h2 className="mt-1 text-2xl font-semibold">{top ? t.reflection.causes[top] : "—"}</h2>
            <h3 id="plan" className="mt-6 flex items-center gap-2 font-semibold">
              <Lightbulb className="size-5 text-ochre-ink" aria-hidden /> {t.reflection.plan}
            </h3>
            <ol className="mt-3 space-y-2">
              {ranked.slice(0, 3).map((c, i) => (
                <li key={c} className="flex gap-3 rounded-2xl bg-surface-2 p-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">{i + 1}</span>
                  <span>
                    <span className="font-medium">{t.reflection.causes[c]}:</span> {t.reflection.tips[c]}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          {(improvements.length > 0 || reviews.length > 0) && (
            <section className="card lg:col-span-2" aria-labelledby="exp">
              <h2 id="exp" className="card-title mb-4">
                {t.reflection.recentExperiments}
              </h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl bg-surface-2 p-4 text-sm">
                    <span className="badge mb-1.5">{fmt(t.reflection.weekOf, { from: fromDbDate(r.weekStart).slice(5), to: addDays(fromDbDate(r.weekStart), 6).slice(5) })}</span>
                    <p>{r.experiment}</p>
                  </li>
                ))}
                {improvements.map((j) => (
                  <li key={j.id} className="rounded-2xl bg-surface-2 p-4 text-sm">
                    <span className="badge mb-1.5">{fromDbDate(j.date)}</span>
                    <p>{j.tomorrow}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      );
  }

  return (
    <>
      <PageHeader title={t.reflection.title} subtitle={t.reflection.subtitle} />
      <SegmentLinks
        ariaLabel={t.reflection.title}
        active={tab}
        className="mb-6 max-w-full"
        items={tabs.map((x) => ({ value: x.id, label: x.label, href: `/reflection?tab=${x.id}` }))}
      />
      {body}
    </>
  );
}
