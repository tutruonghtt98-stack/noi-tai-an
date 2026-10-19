import "server-only";
import { db } from "@/lib/db";
import { addDays, fromDbDate, todayISO } from "@/lib/dates";

/** Danh mục huy hiệu. Tên/mô tả hiển thị nằm trong i18n (community.badges). */
export const BADGES = [
  "FIRST_STEP", // tạo mục tiêu đầu tiên
  "FIRST_POST", // bài viết cộng đồng đầu tiên
  "STREAK_7",
  "STREAK_21",
  "STREAK_66",
  "FOCUS_10H",
  "FOCUS_100H",
  "GOAL_DONE",
  "JOURNAL_7",
  "CHALLENGE_DONE",
  "CHEERLEADER", // động viên 20 lần
  "GROUP_FOUNDER",
] as const;
export type BadgeCode = (typeof BADGES)[number];

export async function award(userId: string, code: string, meta?: string) {
  await db.userBadge.upsert({ where: { userId_code: { userId, code } }, update: {}, create: { userId, code, meta } });
}

/** Chuỗi dài nhất hiện tại của bất kỳ thói quen nào (tính trên 70 ngày gần nhất). */
async function bestCurrentStreak(userId: string, timezone: string) {
  const today = todayISO(timezone);
  const habits = await db.habit.findMany({
    where: { userId, archivedAt: null },
    select: { daysOfWeek: true, targetPerDay: true, logs: { where: { date: { gte: new Date(`${addDays(today, -70)}T00:00:00Z`) } }, select: { date: true, count: true } } },
  });
  let best = 0;
  for (const h of habits) {
    const done = new Set(h.logs.filter((l) => l.count >= h.targetPerDay).map((l) => fromDbDate(l.date)));
    let n = 0;
    let d = done.has(today) ? today : addDays(today, -1);
    for (let i = 0; i < 70; i++, d = addDays(d, -1)) {
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      if (h.daysOfWeek.length && !h.daysOfWeek.includes(dow)) continue;
      if (!done.has(d)) break;
      n++;
    }
    best = Math.max(best, n);
  }
  return best;
}

/** Kiểm tra & trao huy hiệu còn thiếu. Gọi sau các sự kiện quan trọng (chạy nền bằng after()). */
export async function syncBadges(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true, badges: { select: { code: true } } } });
  if (!user) return;
  const has = new Set(user.badges.map((b) => b.code));
  const missing = (c: BadgeCode) => !has.has(c);

  const [goals, goalDone, posts, focus, journals, cheers, founded, challengeDone, streak] = await Promise.all([
    missing("FIRST_STEP") ? db.goal.count({ where: { userId } }) : 1,
    missing("GOAL_DONE") ? db.goal.count({ where: { userId, status: "COMPLETED" } }) : 1,
    missing("FIRST_POST") ? db.post.count({ where: { userId, kind: "POST" } }) : 1,
    missing("FOCUS_100H") ? db.focusSession.aggregate({ where: { userId }, _sum: { actualMinutes: true } }).then((a) => a._sum.actualMinutes ?? 0) : 6000,
    missing("JOURNAL_7") ? db.journalEntry.count({ where: { userId } }) : 7,
    missing("CHEERLEADER") ? db.cheer.count({ where: { userId } }) : 20,
    missing("GROUP_FOUNDER") ? db.groupMember.count({ where: { userId, role: "OWNER" } }) : 1,
    missing("CHALLENGE_DONE") ? db.challengeMember.count({ where: { userId, completedAt: { not: null } } }) : 1,
    missing("STREAK_66") ? bestCurrentStreak(userId, user.timezone) : 66,
  ]);

  const earn: BadgeCode[] = [];
  if (goals > 0) earn.push("FIRST_STEP");
  if (goalDone > 0) earn.push("GOAL_DONE");
  if (posts > 0) earn.push("FIRST_POST");
  if (focus >= 600) earn.push("FOCUS_10H");
  if (focus >= 6000) earn.push("FOCUS_100H");
  if (journals >= 7) earn.push("JOURNAL_7");
  if (cheers >= 20) earn.push("CHEERLEADER");
  if (founded > 0) earn.push("GROUP_FOUNDER");
  if (challengeDone > 0) earn.push("CHALLENGE_DONE");
  if (streak >= 7) earn.push("STREAK_7");
  if (streak >= 21) earn.push("STREAK_21");
  if (streak >= 66) earn.push("STREAK_66");

  for (const c of earn) if (missing(c)) await award(userId, c);
}
