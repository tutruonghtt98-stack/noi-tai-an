"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncBadges } from "@/lib/badges";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { limitsFor, PlanLimitError } from "@/lib/plan";
import { addDays, isValidISO, toDbDate, todayISO, type ISODate } from "@/lib/dates";

const habitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z
    .string()
    .trim()
    .max(600)
    .optional()
    .transform((v) => v || null),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .transform((a) => (a.length === 7 ? [] : [...new Set(a)].sort())),
  targetPerDay: z.coerce.number().int().min(1).max(20),
  goalId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v || null),
  color: z.enum(["ochre", "jade", "mist", "rose"]),
  icon: z.string().max(40).default("circle-check"),
});
export type HabitInput = z.input<typeof habitSchema>;

function touch() {
  revalidatePath("/habits");
  revalidatePath("/dashboard");
  revalidatePath("/today");
}

async function assertGoal(userId: string, goalId: string | null) {
  if (!goalId) return;
  const g = await db.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
  if (!g) throw new UserError("NOT_FOUND");
}

export async function createHabit(input: HabitInput) {
  return run(async () => {
    const user = await requireUser();
    const data = habitSchema.parse(input);
    const count = await db.habit.count({ where: { userId: user.id, archivedAt: null } });
    if (count >= limitsFor(user).habits) throw new PlanLimitError("habits");
    await assertGoal(user.id, data.goalId);
    await db.habit.create({ data: { ...data, userId: user.id, sortOrder: count + 1 } });
    touch();
  });
}

export async function updateHabit(id: string, input: HabitInput) {
  return run(async () => {
    const user = await requireUser();
    const data = habitSchema.parse(input);
    await assertGoal(user.id, data.goalId);
    const res = await db.habit.updateMany({ where: { id, userId: user.id }, data });
    if (!res.count) throw new UserError("NOT_FOUND");
    touch();
  });
}

export async function archiveHabit(id: string) {
  return run(async () => {
    const user = await requireUser();
    const res = await db.habit.updateMany({ where: { id, userId: user.id }, data: { archivedAt: new Date() } });
    if (!res.count) throw new UserError("NOT_FOUND");
    touch();
  });
}

export async function deleteHabit(id: string) {
  return run(async () => {
    const user = await requireUser();
    const res = await db.habit.deleteMany({ where: { id, userId: user.id } });
    if (!res.count) throw new UserError("NOT_FOUND");
    touch();
  });
}

/**
 * Check-in: tăng số lần trong ngày; khi vượt mục tiêu thì quay về 0.
 * Với thói quen 1 lần/ngày, đây chính là bật/tắt.
 * Chỉ cho phép check-in trong 7 ngày gần nhất (không sửa lịch sử xa, không check-in tương lai).
 */
export async function toggleHabit(habitId: string, date: ISODate) {
  return run(async () => {
    const user = await requireUser();
    if (!isValidISO(date)) throw new UserError("VALIDATION");
    const today = todayISO(user.timezone);
    if (date > today || date < addDays(today, -7)) throw new UserError("DATE_LOCKED");
    const habit = await db.habit.findFirst({ where: { id: habitId, userId: user.id, archivedAt: null } });
    if (!habit) throw new UserError("NOT_FOUND");

    const key = { habitId_date: { habitId, date: toDbDate(date) } };
    const existing = await db.habitLog.findUnique({ where: key });
    const next = (existing?.count ?? 0) + 1;
    if (next > habit.targetPerDay) {
      await db.habitLog.delete({ where: key });
    } else if (existing) {
      await db.habitLog.update({ where: key, data: { count: next } });
    } else {
      await db.habitLog.create({ data: { habitId, userId: user.id, date: toDbDate(date), count: 1 } });
    }
    touch();
    after(() => syncBadges(user.id));
    return { count: next > habit.targetPerDay ? 0 : next };
  });
}
