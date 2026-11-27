import "server-only";
import { db } from "@/lib/db";
import { addDays, fromDbDate, toDbDate, todayISO, type ISODate } from "@/lib/dates";
import { habitStats, isScheduled } from "@/lib/stats";
import { fmt } from "@/lib/i18n/format";
import vi from "@/lib/i18n/vi";
import en from "@/lib/i18n/en";

export const PERSONAL_MILESTONES = [7, 21, 30, 66, 100, 365];
export const GROUP_MILESTONES = [3, 7, 14, 30, 60, 100];

const reached = (n: number, list: number[]) => [...list].reverse().find((m) => n >= m) ?? null;

/** Ghi nhận thành tích; trả về true nếu là lần đầu (chưa từng đăng). */
async function claim(key: string, owner: { userId?: string; groupId?: string }) {
  try {
    await db.achievement.create({ data: { key, ...owner } });
    return true;
  } catch {
    return false; // đã tồn tại
  }
}

/** Các ngày có hoạt động kỷ luật của từng người (thói quen, tập trung, việc xong, check-in thử thách). */
export async function activityDays(userIds: string[], from: ISODate) {
  const since = toDbDate(from);
  const where = { userId: { in: userIds }, date: { gte: since } };
  const [logs, focus, tasks, checkins] = await Promise.all([
    db.habitLog.findMany({ where, select: { userId: true, date: true } }),
    db.focusSession.findMany({ where, select: { userId: true, date: true } }),
    db.task.findMany({ where: { ...where, status: "DONE" }, select: { userId: true, date: true } }),
    db.challengeCheckin.findMany({ where, select: { userId: true, date: true } }),
  ]);
  const map = new Map<string, Set<ISODate>>(userIds.map((id) => [id, new Set()]));
  for (const r of [...logs, ...focus, ...tasks, ...checkins]) if (r.date) map.get(r.userId)?.add(fromDbDate(r.date));
  return map;
}

/** Ngày bắt đầu của chuỗi thói quen hiện tại (để phân biệt chuỗi mới và chuỗi cũ). */
function habitStreakStart(habit: { daysOfWeek: number[] }, done: (d: ISODate) => boolean, today: ISODate, length: number) {
  let d = done(today) ? today : addDays(today, -1);
  let start = d;
  for (let n = 0; n < length && n < 400; d = addDays(d, -1)) {
    if (!isScheduled(habit, d)) continue;
    start = d;
    n++;
  }
  return start;
}

/**
 * Kiểm tra & tự động đăng thành tích lên bảng tin sau một hoạt động:
 *  - Chuỗi cá nhân của từng thói quen đạt mốc 7/21/30/66/100/365 ngày (nếu người dùng bật tự chia sẻ).
 *  - Chuỗi nhóm: số ngày liên tiếp MỌI thành viên đều có hoạt động, đạt mốc 3/7/14/30/60/100.
 *    Đăng vào bảng tin nhóm; nếu nhóm công khai thì đăng thêm lên bảng tin chung.
 */
export async function checkAchievements(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, timezone: true, locale: true, bannedAt: true, autoShareAchievements: true },
  });
  if (!user || user.bannedAt) return;
  const t = user.locale === "en" ? en : vi;
  const today = todayISO(user.timezone);

  // ---- Chuỗi cá nhân ----
  if (user.autoShareAchievements) {
    const habits = await db.habit.findMany({
      where: { userId, archivedAt: null },
      include: { logs: { where: { date: { gte: toDbDate(addDays(today, -400)) } }, select: { date: true, count: true } } },
    });
    for (const h of habits) {
      const logs = new Map(h.logs.map((l) => [fromDbDate(l.date), l.count]));
      const { current } = habitStats(h, logs, today);
      const m = reached(current, PERSONAL_MILESTONES);
      if (!m) continue;
      const start = habitStreakStart(h, (d) => (logs.get(d) ?? 0) >= h.targetPerDay, today, current);
      const isNew = await claim(`streak:${h.id}:${m}:${start}`, { userId });
      // Đánh dấu luôn các mốc thấp hơn của cùng chuỗi để không đăng dồn
      for (const lower of PERSONAL_MILESTONES.filter((x) => x < m)) await claim(`streak:${h.id}:${lower}:${start}`, { userId });
      if (!isNew) continue;
      await db.post.create({
        data: { userId, kind: "ACHIEVEMENT", category: "GOAL", content: fmt(t.achievements.personal, { n: m, h: h.name }) },
      });
    }
  }

  // ---- Chuỗi nhóm ----
  const memberships = await db.groupMember.findMany({
    where: { userId },
    include: { group: { include: { members: { select: { userId: true, joinedAt: true } } } } },
  });
  for (const { group } of memberships) {
    if (group.members.length < 2) continue;
    const ids = group.members.map((m) => m.userId);
    const days = await activityDays(ids, addDays(today, -110));
    const allActive = (d: ISODate) =>
      group.members.every((m) => fromDbDate(m.joinedAt) > d || days.get(m.userId)?.has(d)) &&
      group.members.some((m) => fromDbDate(m.joinedAt) <= d);
    let d = allActive(today) ? today : addDays(today, -1);
    let streak = 0;
    let start = d;
    while (streak < 110 && allActive(d)) {
      start = d;
      streak++;
      d = addDays(d, -1);
    }
    const m = reached(streak, GROUP_MILESTONES);
    if (!m) continue;
    const isNew = await claim(`group:${group.id}:${m}:${start}`, { groupId: group.id });
    for (const lower of GROUP_MILESTONES.filter((x) => x < m)) await claim(`group:${group.id}:${lower}:${start}`, { groupId: group.id });
    if (!isNew) continue;
    const content = fmt(t.achievements.group, { n: m, g: group.name, k: group.members.length });
    await db.post.create({ data: { userId, kind: "ACHIEVEMENT", category: "GOAL", content, groupId: group.id } });
    if (group.isPublic) await db.post.create({ data: { userId, kind: "ACHIEVEMENT", category: "GOAL", content } });
  }
}
