import { addDays, dayOfWeek, type ISODate } from "@/lib/dates";

// ---------- Habits ----------

export type HabitLike = { daysOfWeek: number[]; targetPerDay: number; createdAt: Date };

export function isScheduled(habit: Pick<HabitLike, "daysOfWeek">, iso: ISODate) {
  return habit.daysOfWeek.length === 0 || habit.daysOfWeek.includes(dayOfWeek(iso));
}

/** logs: map iso -> count */
export function habitStats(habit: HabitLike, logs: Map<ISODate, number>, today: ISODate, windowDays = 30) {
  const created = habit.createdAt.toISOString().slice(0, 10);
  const done = (iso: ISODate) => (logs.get(iso) ?? 0) >= habit.targetPerDay;

  // Chuỗi hiện tại: hôm nay chưa xong thì chưa tính là đứt chuỗi.
  let current = 0;
  let cursor = today;
  if (isScheduled(habit, today) && !done(today)) cursor = addDays(today, -1);
  for (let i = 0; i < 1000 && cursor >= created; i++) {
    if (isScheduled(habit, cursor)) {
      if (!done(cursor)) break;
      current++;
    }
    cursor = addDays(cursor, -1);
  }

  // Chuỗi dài nhất trong lịch sử log
  let best = 0;
  let run = 0;
  const sorted = [...logs.keys()].sort();
  if (sorted.length) {
    for (let d = sorted[0]; d <= today; d = addDays(d, 1)) {
      if (!isScheduled(habit, d)) continue;
      if (done(d)) {
        run++;
        best = Math.max(best, run);
      } else if (d !== today) {
        run = 0;
      }
    }
  }
  best = Math.max(best, current);

  // Tỷ lệ duy trì trong cửa sổ N ngày (chỉ tính ngày có lịch, kể từ khi tạo)
  let due = 0;
  let hit = 0;
  for (let i = 0; i < windowDays; i++) {
    const d = addDays(today, -i);
    if (d < created) break;
    if (!isScheduled(habit, d)) continue;
    if (d === today && !done(d)) continue; // hôm nay vẫn còn thời gian
    due++;
    if (done(d)) hit++;
  }
  const rate = due === 0 ? 0 : hit / due;

  return { current, best, rate, doneToday: done(today), scheduledToday: isScheduled(habit, today) };
}

// ---------- Goals ----------

export type GoalForProgress = {
  status: string;
  targetValue: number | null;
  currentValue: number;
  _count?: { tasks: number };
  doneTasks?: number;
  childProgress?: number[];
};

export function goalProgress(g: GoalForProgress): number {
  if (g.status === "COMPLETED") return 1;
  if (g.targetValue && g.targetValue > 0) return clamp(g.currentValue / g.targetValue);
  // Mỗi hành động và mỗi mục tiêu con là một "đơn vị" đóng góp ngang nhau
  const total = g._count?.tasks ?? 0;
  const kids = g.childProgress ?? [];
  const units = total + kids.length;
  if (units === 0) return 0;
  return clamp(((g.doneTasks ?? 0) + kids.reduce((s, x) => s + x, 0)) / units);
}

// ---------- Discipline score ----------

export type DisciplineInput = {
  prioritiesDone: number;
  prioritiesTotal: number;
  habitsDone: number;
  habitsDue: number;
  focusMinutes: number;
  focusGoal: number;
};

/**
 * Điểm kỷ luật trong ngày (0–100):
 * 40% Top 3 ưu tiên · 40% thói quen · 20% thời gian tập trung.
 * Thành phần nào chưa được thiết lập thì trọng số chia lại cho phần còn lại.
 */
export function disciplineScore(i: DisciplineInput) {
  const parts: { value: number; weight: number }[] = [];
  if (i.prioritiesTotal > 0) parts.push({ value: i.prioritiesDone / i.prioritiesTotal, weight: 40 });
  if (i.habitsDue > 0) parts.push({ value: i.habitsDone / i.habitsDue, weight: 40 });
  if (i.focusGoal > 0) parts.push({ value: clamp(i.focusMinutes / i.focusGoal), weight: 20 });
  const w = parts.reduce((s, p) => s + p.weight, 0);
  const score = w === 0 ? 0 : Math.round((parts.reduce((s, p) => s + p.value * p.weight, 0) / w) * 100);
  return score;
}

export function scoreBand(score: number): "low" | "mid" | "high" {
  if (score >= 80) return "high";
  if (score >= 40) return "mid";
  return "low";
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
