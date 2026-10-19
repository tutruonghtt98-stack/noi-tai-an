import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";
import { addDays, fromDbDate, monthBounds, rangeISO, toDbDate, type ISODate } from "@/lib/dates";
import { disciplineScore, goalProgress, habitStats, isScheduled } from "@/lib/stats";

// ---------- Habits ----------

export async function getHabitsWithStats(user: CurrentUser, today: ISODate, historyDays = 400) {
  const habits = await db.habit.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      goal: { select: { id: true, title: true } },
      logs: { where: { date: { gte: toDbDate(addDays(today, -historyDays)) } }, select: { date: true, count: true } },
    },
  });
  return habits.map((h) => {
    const logs = new Map(h.logs.map((l) => [fromDbDate(l.date), l.count]));
    return {
      id: h.id,
      name: h.name,
      description: h.description,
      color: h.color,
      icon: h.icon,
      daysOfWeek: h.daysOfWeek,
      targetPerDay: h.targetPerDay,
      goalId: h.goalId,
      goal: h.goal,
      createdAt: fromDbDate(h.createdAt),
      logs: Object.fromEntries(logs) as Record<ISODate, number>,
      todayCount: logs.get(today) ?? 0,
      stats: habitStats(h, logs, today),
    };
  });
}
export type HabitView = Awaited<ReturnType<typeof getHabitsWithStats>>[number];

// ---------- Day ----------

export async function getDay(user: CurrentUser, date: ISODate) {
  const d = toDbDate(date);
  const [tasks, plan, focus] = await Promise.all([
    db.task.findMany({
      where: { userId: user.id, date: d },
      orderBy: [{ priority: { sort: "asc", nulls: "last" } }, { status: "asc" }, { startTime: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
      include: { goal: { select: { id: true, title: true, color: true } } },
    }),
    db.dailyPlan.findUnique({ where: { userId_date: { userId: user.id, date: d } } }),
    db.focusSession.findMany({ where: { userId: user.id, date: d }, orderBy: { startedAt: "asc" } }),
  ]);
  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      notes: t.notes,
      priority: t.priority,
      startTime: t.startTime,
      estimateMin: t.estimateMin,
      done: t.status === "DONE",
      goal: t.goal,
    })),
    plan: plan ? { intention: plan.intention, energy: plan.energy } : null,
    focusMinutes: focus.reduce((s, f) => s + f.actualMinutes, 0),
    focusCount: focus.length,
  };
}
export type DayView = Awaited<ReturnType<typeof getDay>>;
export type TaskView = DayView["tasks"][number];

export async function getBacklog(user: CurrentUser) {
  return db.task.findMany({
    where: { userId: user.id, date: null, status: "TODO" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, title: true, goal: { select: { id: true, title: true } } },
  });
}

/** Việc cũ chưa xong (trước hôm nay) — gợi ý kéo sang hôm nay. */
export async function getOverdue(user: CurrentUser, today: ISODate) {
  return db.task.findMany({
    where: { userId: user.id, status: "TODO", date: { lt: toDbDate(today), gte: toDbDate(addDays(today, -14)) } },
    orderBy: { date: "desc" },
    take: 20,
    select: { id: true, title: true, date: true, goal: { select: { id: true, title: true } } },
  });
}

// ---------- Goals ----------

export async function getGoals(user: CurrentUser, where: { year?: number; horizon?: "YEAR" | "QUARTER" | "MONTH" } = {}) {
  const goals = await db.goal.findMany({
    where: { userId: user.id, status: { not: "ARCHIVED" }, ...where },
    orderBy: [{ status: "asc" }, { horizon: "asc" }, { quarter: "asc" }, { month: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { tasks: true, children: true, projects: true } },
      parent: { select: { id: true, title: true } },
    },
  });
  // Tiến độ tính đệ quy trên toàn bộ cây mục tiêu: mỗi hành động và mỗi mục tiêu con là một đơn vị.
  const [all, taskCounts] = await Promise.all([
    db.goal.findMany({
      where: { userId: user.id, status: { not: "ARCHIVED" } },
      select: { id: true, parentId: true, status: true, targetValue: true, currentValue: true },
    }),
    db.task.groupBy({ by: ["goalId", "status"], where: { userId: user.id, goalId: { not: null } }, _count: true }),
  ]);
  const totals = new Map<string, { total: number; done: number }>();
  for (const c of taskCounts) {
    const e = totals.get(c.goalId!) ?? { total: 0, done: 0 };
    e.total += c._count;
    if (c.status === "DONE") e.done += c._count;
    totals.set(c.goalId!, e);
  }
  const childrenOf = new Map<string, typeof all>();
  for (const g of all) if (g.parentId) childrenOf.set(g.parentId, [...(childrenOf.get(g.parentId) ?? []), g]);
  const memo = new Map<string, number>();
  const progressOf = (g: (typeof all)[number], depth = 0): number => {
    if (memo.has(g.id)) return memo.get(g.id)!;
    const c = totals.get(g.id) ?? { total: 0, done: 0 };
    const value = goalProgress({
      ...g,
      _count: { tasks: c.total },
      doneTasks: c.done,
      childProgress: depth > 5 ? [] : (childrenOf.get(g.id) ?? []).map((k) => progressOf(k, depth + 1)),
    });
    memo.set(g.id, value);
    return value;
  };
  const doneMap = new Map([...totals].map(([id, v]) => [id, v.done]));

  return goals.map((g) => {
    const progress = progressOf(g);
    return {
      id: g.id,
      title: g.title,
      why: g.why,
      horizon: g.horizon,
      year: g.year,
      quarter: g.quarter,
      month: g.month,
      status: g.status,
      color: g.color,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      unit: g.unit,
      dueDate: g.dueDate ? fromDbDate(g.dueDate) : null,
      completedAt: g.completedAt ? g.completedAt.toISOString() : null,
      parent: g.parent,
      counts: { tasks: g._count.tasks, done: doneMap.get(g.id) ?? 0, children: g._count.children, projects: g._count.projects },
      progress,
    };
  });
}
export type GoalView = Awaited<ReturnType<typeof getGoals>>[number];

export async function getGoalOptions(user: CurrentUser) {
  return db.goal.findMany({
    where: { userId: user.id, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: [{ horizon: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, horizon: true, year: true, quarter: true, month: true },
  });
}
export type GoalOption = Awaited<ReturnType<typeof getGoalOptions>>[number];

export async function getGoalDetail(user: CurrentUser, id: string) {
  const goal = await db.goal.findFirst({
    where: { id, userId: user.id },
    include: {
      parent: { select: { id: true, title: true } },
      children: { orderBy: { createdAt: "asc" }, select: { id: true } },
      projects: {
        where: { status: { not: "ARCHIVED" } },
        orderBy: { createdAt: "asc" },
        include: { tasks: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] } },
      },
      tasks: { where: { projectId: null }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
      habits: { where: { archivedAt: null }, select: { id: true, name: true, color: true } },
    },
  });
  if (!goal) return null;
  const list = await getGoals(user);
  const self = list.find((g) => g.id === id);
  const children = list.filter((g) => g.parent?.id === id);
  return { goal, view: self!, children };
}

// ---------- Dashboard ----------

export async function getDashboard(user: CurrentUser, today: ISODate) {
  const [day, habits, goals] = await Promise.all([
    getDay(user, today),
    getHabitsWithStats(user, today),
    getGoals(user, {}),
  ]);

  const priorities = day.tasks.filter((t) => t.priority);
  const dueHabits = habits.filter((h) => h.stats.scheduledToday);
  const score = disciplineScore({
    prioritiesDone: priorities.filter((p) => p.done).length,
    prioritiesTotal: priorities.length,
    habitsDone: dueHabits.filter((h) => h.stats.doneToday).length,
    habitsDue: dueHabits.length,
    focusMinutes: day.focusMinutes,
    focusGoal: user.dailyFocusGoal,
  });

  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const avgProgress = activeGoals.length
    ? activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length
    : 0;
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.stats.current), 0);

  const [y, m] = today.split("-").map(Number) as [number, number];
  const calendar = await getMonthCalendar(user, y, m, today, habits);
  const monthKey = today.slice(0, 7);
  const completedThisMonth = goals.filter((g) => g.status === "COMPLETED" && g.completedAt?.startsWith(monthKey)).length;

  return { day, habits, goals, score, priorities, dueHabits, activeGoals, avgProgress, bestStreak, calendar, completedThisMonth };
}

/** Điểm kỷ luật cho từng ngày trong tháng (đến hôm nay). */
export async function getMonthCalendar(user: CurrentUser, year: number, month: number, today: ISODate, habits: HabitView[]) {
  const { from, to } = monthBounds(year, month);
  const [tasks, focus] = await Promise.all([
    db.task.findMany({
      where: { userId: user.id, priority: { not: null }, date: { gte: toDbDate(from), lte: toDbDate(to) } },
      select: { date: true, status: true },
    }),
    db.focusSession.groupBy({
      by: ["date"],
      where: { userId: user.id, date: { gte: toDbDate(from), lte: toDbDate(to) } },
      _sum: { actualMinutes: true },
    }),
  ]);
  const focusMap = new Map(focus.map((f) => [fromDbDate(f.date), f._sum.actualMinutes ?? 0]));

  const days: Record<ISODate, number | null> = {};
  for (const iso of rangeISO(from, to)) {
    if (iso > today) {
      days[iso] = null;
      continue;
    }
    const dayTasks = tasks.filter((t) => t.date && fromDbDate(t.date) === iso);
    const due = habits.filter((h) => iso >= h.createdAt && isScheduled(h, iso));
    const done = due.filter((h) => (h.logs[iso] ?? 0) >= h.targetPerDay);
    const fm = focusMap.get(iso) ?? 0;
    const hasData = dayTasks.length || done.length || fm;
    days[iso] = hasData
      ? disciplineScore({
          prioritiesDone: dayTasks.filter((t) => t.status === "DONE").length,
          prioritiesTotal: dayTasks.length,
          habitsDone: done.length,
          habitsDue: due.length,
          focusMinutes: fm,
          focusGoal: user.dailyFocusGoal,
        })
      : null;
  }
  return { year, month, days };
}
