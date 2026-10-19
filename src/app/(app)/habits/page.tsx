import type { Metadata } from "next";
import { Repeat } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { todayISO } from "@/lib/dates";
import { getGoalOptions, getHabitsWithStats } from "@/lib/queries";
import { HabitCard, NewHabitButton } from "@/components/habits";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/ui/empty";
import { ProgressRing } from "@/components/ui/progress-ring";

export const metadata: Metadata = { title: "Thói quen" };

export default async function HabitsPage() {
  const user = await requireUser();
  const { t } = await getI18n();
  const today = todayISO(user.timezone);
  const [habits, goals] = await Promise.all([getHabitsWithStats(user, today), getGoalOptions(user)]);
  const due = habits.filter((h) => h.stats.scheduledToday);
  const done = due.filter((h) => h.stats.doneToday).length;
  const avgRate = habits.length ? habits.reduce((s, h) => s + h.stats.rate, 0) / habits.length : 0;

  return (
    <>
      <PageHeader title={t.habits.title} subtitle={t.habits.subtitle} action={<NewHabitButton goals={goals} />} />

      {habits.length > 0 && (
        <section className="card mb-[var(--gap)] flex flex-wrap items-center gap-x-10 gap-y-5">
          <div className="flex items-center gap-4">
            <ProgressRing value={due.length ? done / due.length : 0} size={72} stroke={8}>
              <span className="tabular text-sm font-semibold">
                {done}/{due.length}
              </span>
            </ProgressRing>
            <div>
              <p className="text-sm text-muted">{t.dashboard.habitsToday}</p>
              <p className="text-lg font-semibold">{t.common.today}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted">{t.habits.rate30}</p>
            <p className="tabular text-3xl font-semibold">{Math.round(avgRate * 100)}%</p>
          </div>
          <div>
            <p className="text-sm text-muted">{t.dashboard.bestStreak}</p>
            <p className="tabular text-3xl font-semibold">
              {habits.reduce((m, h) => Math.max(m, h.stats.best), 0)}
              <span className="ml-1 text-base font-normal text-muted">{t.common.days}</span>
            </p>
          </div>
        </section>
      )}

      {habits.length === 0 ? (
        <div className="card">
          <Empty icon={Repeat} text={t.habits.empty}>
            <NewHabitButton goals={goals} />
          </Empty>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--gap)] md:grid-cols-2 xl:grid-cols-3">
          {habits.map((h) => (
            <HabitCard key={h.id} habit={h} today={today} goals={goals} weekStartsOn={user.weekStartsOn} />
          ))}
        </div>
      )}
    </>
  );
}
