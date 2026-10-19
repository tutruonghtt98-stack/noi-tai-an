"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncBadges } from "@/lib/badges";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { limitsFor, PlanLimitError } from "@/lib/plan";
import { isValidISO, toDbDate } from "@/lib/dates";

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const goalSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    why: optText(600),
    description: optText(2000),
    horizon: z.enum(["YEAR", "QUARTER", "MONTH", "WEEK"]),
    weekStart: z.string().optional().nullable().transform((v) => (v && isValidISO(v) ? v : null)),
    year: z.coerce.number().int().min(2000).max(2100),
    quarter: z.coerce.number().int().min(1).max(4).optional().nullable(),
    month: z.coerce.number().int().min(1).max(12).optional().nullable(),
    parentId: z.string().optional().nullable().transform((v) => v || null),
    targetValue: z
      .union([z.coerce.number().positive().max(1e9), z.literal("")])
      .optional()
      .nullable()
      .transform((v) => (v === "" || v == null ? null : v)),
    unit: optText(24),
    dueDate: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v && isValidISO(v) ? toDbDate(v) : null)),
    color: z.enum(["ochre", "jade", "mist", "rose"]).default("ochre"),
  })
  .transform((g) => {
    // Cột mốc tuần: năm/quý/tháng suy ra từ ngày đầu tuần
    if (g.horizon === "WEEK") {
      const ws = g.weekStart ?? new Date().toISOString().slice(0, 10);
      const m = Number(ws.slice(5, 7));
      return { ...g, year: Number(ws.slice(0, 4)), month: m, quarter: Math.ceil(m / 3), weekStart: toDbDate(ws) };
    }
    return {
      ...g,
      weekStart: null,
      quarter: g.horizon === "QUARTER" ? (g.quarter ?? 1) : g.horizon === "MONTH" && g.month ? Math.ceil(g.month / 3) : null,
      month: g.horizon === "MONTH" ? (g.month ?? 1) : null,
    };
  });

export type GoalInput = z.input<typeof goalSchema>;

async function assertParent(userId: string, parentId: string | null, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw new UserError("INVALID_PARENT");
  const p = await db.goal.findFirst({ where: { id: parentId, userId }, select: { id: true } });
  if (!p) throw new UserError("NOT_FOUND");
}

export async function createGoal(input: GoalInput) {
  return run(async () => {
    const user = await requireUser();
    const data = goalSchema.parse(input);
    const active = await db.goal.count({ where: { userId: user.id, status: "ACTIVE" } });
    const limit = limitsFor(user).activeGoals;
    if (active >= limit) throw new PlanLimitError("activeGoals");
    await assertParent(user.id, data.parentId);
    const goal = await db.goal.create({ data: { ...data, userId: user.id } });
    after(() => syncBadges(user.id));
    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { id: goal.id };
  });
}

export async function updateGoal(id: string, input: GoalInput) {
  return run(async () => {
    const user = await requireUser();
    const data = goalSchema.parse(input);
    await assertParent(user.id, data.parentId, id);
    const res = await db.goal.updateMany({ where: { id, userId: user.id }, data });
    if (!res.count) throw new UserError("NOT_FOUND");
    revalidatePath("/goals", "layout");
    revalidatePath("/dashboard");
  });
}

export async function setGoalStatus(id: string, status: "ACTIVE" | "COMPLETED" | "PAUSED" | "ARCHIVED") {
  return run(async () => {
    const user = await requireUser();
    const s = z.enum(["ACTIVE", "COMPLETED", "PAUSED", "ARCHIVED"]).parse(status);
    if (s === "ACTIVE") {
      const active = await db.goal.count({ where: { userId: user.id, status: "ACTIVE", NOT: { id } } });
      if (active >= limitsFor(user).activeGoals) throw new PlanLimitError("activeGoals");
    }
    const res = await db.goal.updateMany({
      where: { id, userId: user.id },
      data: { status: s, completedAt: s === "COMPLETED" ? new Date() : null },
    });
    after(() => syncBadges(user.id));
    if (!res.count) throw new UserError("NOT_FOUND");
    revalidatePath("/goals", "layout");
    revalidatePath("/dashboard");
  });
}

export async function setGoalValue(id: string, value: number) {
  return run(async () => {
    const user = await requireUser();
    const v = z.number().min(0).max(1e9).parse(value);
    const goal = await db.goal.findFirst({ where: { id, userId: user.id } });
    if (!goal) throw new UserError("NOT_FOUND");
    const reached = goal.targetValue != null && v >= goal.targetValue;
    await db.goal.update({
      where: { id },
      data: {
        currentValue: v,
        ...(reached && goal.status === "ACTIVE" ? { status: "COMPLETED", completedAt: new Date() } : {}),
      },
    });
    revalidatePath("/goals", "layout");
    revalidatePath("/dashboard");
  });
}

export async function deleteGoal(id: string) {
  return run(async () => {
    const user = await requireUser();
    const res = await db.goal.deleteMany({ where: { id, userId: user.id } });
    if (!res.count) throw new UserError("NOT_FOUND");
    revalidatePath("/goals", "layout");
    revalidatePath("/dashboard");
  });
}

// ---------- Projects ----------

export async function createProject(goalId: string, title: string) {
  return run(async () => {
    const user = await requireUser();
    const t = z.string().trim().min(1).max(160).parse(title);
    const goal = await db.goal.findFirst({ where: { id: goalId, userId: user.id }, select: { id: true } });
    if (!goal) throw new UserError("NOT_FOUND");
    await db.project.create({ data: { userId: user.id, goalId, title: t } });
    revalidatePath(`/goals/${goalId}`);
  });
}

export async function setProjectStatus(id: string, status: "ACTIVE" | "DONE" | "ARCHIVED") {
  return run(async () => {
    const user = await requireUser();
    const s = z.enum(["ACTIVE", "DONE", "ARCHIVED"]).parse(status);
    const p = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!p) throw new UserError("NOT_FOUND");
    await db.project.update({ where: { id }, data: { status: s } });
    if (p.goalId) revalidatePath(`/goals/${p.goalId}`);
  });
}

export async function deleteProject(id: string) {
  return run(async () => {
    const user = await requireUser();
    const p = await db.project.findFirst({ where: { id, userId: user.id } });
    if (!p) throw new UserError("NOT_FOUND");
    // Giữ lại hành động, chỉ bỏ liên kết dự án
    await db.project.delete({ where: { id } });
    if (p.goalId) revalidatePath(`/goals/${p.goalId}`);
  });
}
