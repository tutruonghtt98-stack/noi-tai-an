import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Repeat } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { fromDbDate, todayISO } from "@/lib/dates";
import { getGoalDetail, getGoalOptions } from "@/lib/queries";
import { GoalCard, GoalControls, GoalValue, NewGoalButton } from "@/components/goals";
import { periodLabel } from "@/lib/goal-format";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ActionItem, AddTask } from "@/components/tasks";
import { ProjectCard, NewProject } from "./projects";
import { colorVar, inkVar, softVar } from "@/lib/colors";

export const metadata: Metadata = { title: "Mục tiêu" };

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const { id } = await params;
  const [data, options] = await Promise.all([getGoalDetail(user, id), getGoalOptions(user)]);
  if (!data) notFound();
  const { goal, view, children } = data;
  const today = todayISO(user.timezone);
  const childHorizon = goal.horizon === "YEAR" ? "QUARTER" : goal.horizon === "QUARTER" ? "MONTH" : null;

  return (
    <>
      <Link href="/goals" className="btn btn-ghost -ml-3 mb-4">
        <ArrowLeft className="size-4" aria-hidden /> {t.goals.back}
      </Link>

      <section className="card hero-glow mb-[var(--gap)]" style={{ ["--accent-soft" as string]: softVar(goal.color) }}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <ProgressRing value={view.progress} size={132} stroke={12} color={colorVar(goal.color)} label={`${t.goals.progress} ${Math.round(view.progress * 100)}%`}>
            <span className="tabular text-3xl font-semibold">{Math.round(view.progress * 100)}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="badge" style={{ background: softVar(goal.color), color: inkVar(goal.color) }}>
                {t.goals.horizon[goal.horizon]} · {periodLabel(goal, t)}
              </span>
              <span className="badge">{t.goals.status[goal.status]}</span>
              {goal.dueDate && <span className="badge">{t.goals.fields.due}: {fromDbDate(goal.dueDate)}</span>}
            </div>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{goal.title}</h1>
            {goal.parent && (
              <p className="mt-1 text-sm text-muted">
                ↳{" "}
                <Link href={`/goals/${goal.parent.id}`} className="underline-offset-4 hover:text-ink hover:underline">
                  {goal.parent.title}
                </Link>
              </p>
            )}
            {goal.why && <p className="mt-3 max-w-2xl text-lg text-ink-2">“{goal.why}”</p>}
          </div>
          <GoalControls goal={view} options={options} />
        </div>
        {goal.targetValue != null && (
          <div className="mt-6 border-t border-line pt-5">
            <GoalValue id={goal.id} current={goal.currentValue} target={goal.targetValue} unit={goal.unit} color={goal.color} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-[var(--gap)]">
          <section className="card" aria-labelledby="actions">
            <div className="flex items-baseline justify-between">
              <h2 id="actions" className="card-title">
                {t.goals.actions}
              </h2>
              <span className="text-sm text-muted">{fmt(t.goals.tasksDone, { d: view.counts.done, t: view.counts.tasks })}</span>
            </div>
            <AddTask date={null} goalId={goal.id} placeholder={t.goals.newAction} />
            <ul className="mt-3 space-y-0.5">
              {goal.tasks.map((task) => (
                <ActionItem key={task.id} id={task.id} title={task.title} done={task.status === "DONE"} date={task.date ? fromDbDate(task.date) : null} today={today} />
              ))}
            </ul>
          </section>

          <section aria-labelledby="projects">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="projects" className="card-title">
                {t.goals.projects}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-[var(--gap)]">
              {goal.projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={{ id: p.id, title: p.title, status: p.status, goalId: goal.id }}
                  tasks={p.tasks.map((x) => ({ id: x.id, title: x.title, done: x.status === "DONE", date: x.date ? fromDbDate(x.date) : null }))}
                  today={today}
                />
              ))}
              <NewProject goalId={goal.id} />
            </div>
          </section>
        </div>

        <aside className="grid min-w-0 grid-cols-1 content-start gap-[var(--gap)]">
          {childHorizon && (
            <section className="card" aria-labelledby="children">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="children" className="card-title">
                  {t.goals.children}
                </h2>
                <NewGoalButton
                  options={options}
                  variant="soft"
                  label={t.common.add}
                  defaults={{ horizon: childHorizon, year: goal.year, quarter: goal.quarter, parentId: goal.id, color: goal.color as "ochre" }}
                />
              </div>
              {children.length === 0 ? (
                <p className="text-sm text-muted">{t.goals.noChildren}</p>
              ) : (
                <div className="grid gap-3 [&_.card]:p-5 [&_.card]:shadow-none [&_.card]:ring-1 [&_.card]:ring-line">
                  {children.map((c) => (
                    <GoalCard key={c.id} goal={c} />
                  ))}
                </div>
              )}
            </section>
          )}
          <section className="card" aria-labelledby="habits">
            <h2 id="habits" className="card-title mb-4">
              {t.goals.linkedHabits}
            </h2>
            {goal.habits.length === 0 ? (
              <Link href="/habits" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
                {t.habits.new} →
              </Link>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {goal.habits.map((h) => (
                  <li key={h.id}>
                    <Link href="/habits" className="chip pl-3" style={{ background: softVar(h.color), color: inkVar(h.color) }}>
                      <Repeat className="size-4" aria-hidden /> {h.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
