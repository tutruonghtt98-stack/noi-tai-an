import "server-only";
import { db } from "@/lib/db";
import { addDays, fromDbDate, rangeISO, toDbDate, type ISODate } from "@/lib/dates";
import { isScheduled } from "@/lib/stats";

export type BoardRow = {
  userId: string;
  name: string;
  image: string | null;
  username: string | null;
  completion: number; // 0..1
  checkinDays: number;
  streak: number;
  score: number;
};

/**
 * Bảng xếp hạng tuần — đo sự bền bỉ, không đo độ nổi tiếng:
 *   50% tỷ lệ hoàn thành (thói quen đến hạn + Top 3)
 *   30% số ngày có hoạt động / số ngày đã qua trong tuần
 *   20% chuỗi ngày hoạt động liên tiếp (tối đa 30)
 * Chỉ tính người dùng bật "Xuất hiện trên bảng xếp hạng" (riêng bản thân luôn được tính để tự so sánh).
 */
export async function weeklyLeaderboard(weekStart: ISODate, today: ISODate, viewerId: string, onlyIds?: string[]): Promise<BoardRow[]> {
  const weekEnd = today < addDays(weekStart, 6) ? today : addDays(weekStart, 6);
  const days = rangeISO(weekStart, weekEnd);
  const range = { gte: toDbDate(weekStart), lte: toDbDate(weekEnd) };
  const streakFrom = toDbDate(addDays(today, -40));

  const [logs, focus, tasks, checkins] = await Promise.all([
    db.habitLog.findMany({ where: { date: { gte: streakFrom } }, select: { userId: true, habitId: true, date: true, count: true } }),
    db.focusSession.findMany({ where: { date: { gte: streakFrom } }, select: { userId: true, date: true }, distinct: ["userId", "date"] }),
    db.task.findMany({ where: { date: { gte: streakFrom }, OR: [{ priority: { not: null } }, { status: "DONE" }] }, select: { userId: true, date: true, status: true, priority: true } }),
    db.challengeCheckin.findMany({ where: { date: { gte: streakFrom } }, select: { userId: true, date: true } }),
  ]);

  const activeIds = new Set<string>(onlyIds ?? []);
  const inWeek = (d: Date) => d >= range.gte && d <= range.lte;
  if (!onlyIds) {
    for (const x of [...logs, ...focus, ...checkins]) if (inWeek(x.date)) activeIds.add(x.userId);
    for (const x of tasks) if (x.date && inWeek(x.date) && x.status === "DONE") activeIds.add(x.userId);
  }
  if (!activeIds.size) return [];

  const [users, habits] = await Promise.all([
    db.user.findMany({
      // Trong nhóm (onlyIds), thành viên đã đồng ý chia sẻ số liệu tổng hợp khi tham gia
      where: { id: { in: [...activeIds] }, bannedAt: null, ...(onlyIds ? {} : { OR: [{ leaderboardOptIn: true }, { id: viewerId }] }) },
      select: { id: true, name: true, image: true, username: true, profilePublic: true },
    }),
    db.habit.findMany({ where: { userId: { in: [...activeIds] }, archivedAt: null }, select: { id: true, userId: true, daysOfWeek: true, targetPerDay: true, createdAt: true } }),
  ]);

  const rows: BoardRow[] = users.map((u) => {
    const activity = new Set<ISODate>();
    const add = (d: Date | null) => d && activity.add(fromDbDate(d));
    logs.filter((l) => l.userId === u.id).forEach((l) => add(l.date));
    focus.filter((f) => f.userId === u.id).forEach((f) => add(f.date));
    checkins.filter((c) => c.userId === u.id).forEach((c) => add(c.date));
    const myTasks = tasks.filter((x) => x.userId === u.id);
    myTasks.filter((x) => x.status === "DONE").forEach((x) => add(x.date));

    // Tỷ lệ hoàn thành trong tuần
    const myHabits = habits.filter((h) => h.userId === u.id);
    const myLogs = new Map(logs.filter((l) => l.userId === u.id).map((l) => [`${l.habitId}:${fromDbDate(l.date)}`, l.count]));
    let due = 0;
    let hit = 0;
    for (const d of days) {
      for (const h of myHabits) {
        if (d < fromDbDate(h.createdAt) || !isScheduled(h, d)) continue;
        due++;
        if ((myLogs.get(`${h.id}:${d}`) ?? 0) >= h.targetPerDay) hit++;
      }
    }
    const pr = myTasks.filter((x) => x.priority && x.date && inWeek(x.date));
    due += pr.length;
    hit += pr.filter((x) => x.status === "DONE").length;
    const completion = due ? hit / due : 0;

    const checkinDays = days.filter((d) => activity.has(d)).length;
    let streak = 0;
    for (let d = activity.has(today) ? today : addDays(today, -1); activity.has(d); d = addDays(d, -1)) streak++;

    const score = Math.round(completion * 50 + (checkinDays / days.length) * 30 + (Math.min(streak, 30) / 30) * 20);
    return { userId: u.id, name: u.name ?? "—", image: u.image, username: u.profilePublic ? u.username : null, completion, checkinDays, streak, score };
  });

  return rows.sort((a, b) => b.score - a.score || b.checkinDays - a.checkinDays || b.streak - a.streak).slice(0, 100);
}
