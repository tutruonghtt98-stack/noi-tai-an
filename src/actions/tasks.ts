"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncBadges } from "@/lib/badges";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { isValidISO, toDbDate, todayISO, type ISODate } from "@/lib/dates";

const isoDate = z.string().refine(isValidISO);
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()
  .optional();

function touch(goalId?: string | null) {
  revalidatePath("/today");
  revalidatePath("/dashboard");
  if (goalId) revalidatePath(`/goals/${goalId}`);
  revalidatePath("/goals");
}

async function ownTask(userId: string, id: string) {
  const task = await db.task.findFirst({ where: { id, userId } });
  if (!task) throw new UserError("NOT_FOUND");
  return task;
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  date: isoDate.nullable().optional(),
  goalId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  startTime: time,
  estimateMin: z.coerce.number().int().min(1).max(720).nullable().optional(),
});

export async function createTask(input: z.input<typeof createSchema>) {
  return run(async () => {
    const user = await requireUser();
    const d = createSchema.parse(input);
    if (d.goalId) {
      const g = await db.goal.findFirst({ where: { id: d.goalId, userId: user.id }, select: { id: true } });
      if (!g) throw new UserError("NOT_FOUND");
    }
    let goalId = d.goalId ?? null;
    if (d.projectId) {
      const p = await db.project.findFirst({ where: { id: d.projectId, userId: user.id } });
      if (!p) throw new UserError("NOT_FOUND");
      goalId = goalId ?? p.goalId;
    }
    const last = await db.task.findFirst({
      where: { userId: user.id, date: d.date ? toDbDate(d.date) : null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const task = await db.task.create({
      data: {
        userId: user.id,
        title: d.title,
        date: d.date ? toDbDate(d.date) : null,
        goalId,
        projectId: d.projectId ?? null,
        startTime: d.startTime ?? null,
        estimateMin: d.estimateMin ?? null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
    touch(goalId);
    return { id: task.id };
  });
}

export async function toggleTask(id: string) {
  return run(async () => {
    const user = await requireUser();
    const task = await ownTask(user.id, id);
    const done = task.status !== "DONE";
    await db.task.update({
      where: { id },
      data: { status: done ? "DONE" : "TODO", completedAt: done ? new Date() : null },
    });
    touch(task.goalId);
    return { done };
  });
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  startTime: time,
  estimateMin: z.coerce.number().int().min(1).max(720).nullable().optional(),
  goalId: z.string().nullable().optional(),
});

export async function updateTask(id: string, input: z.input<typeof updateSchema>) {
  return run(async () => {
    const user = await requireUser();
    const task = await ownTask(user.id, id);
    const d = updateSchema.parse(input);
    if (d.goalId) {
      const g = await db.goal.findFirst({ where: { id: d.goalId, userId: user.id }, select: { id: true } });
      if (!g) throw new UserError("NOT_FOUND");
    }
    await db.task.update({ where: { id }, data: d });
    touch(task.goalId);
    if (d.goalId && d.goalId !== task.goalId) touch(d.goalId);
  });
}

export async function deleteTask(id: string) {
  return run(async () => {
    const user = await requireUser();
    const task = await ownTask(user.id, id);
    await db.task.delete({ where: { id } });
    touch(task.goalId);
  });
}

/** Chuyển nhiệm vụ sang ngày khác (hoặc null = về danh sách chưa lên lịch). */
export async function moveTask(id: string, date: ISODate | null) {
  return run(async () => {
    const user = await requireUser();
    const task = await ownTask(user.id, id);
    const d = date === null ? null : isoDate.parse(date);
    await db.task.update({ where: { id }, data: { date: d ? toDbDate(d) : null, priority: null } });
    touch(task.goalId);
  });
}

/** Bật/tắt Top 3 ưu tiên. Tối đa 3 việc mỗi ngày. */
export async function setPriority(id: string, on: boolean) {
  return run(async () => {
    const user = await requireUser();
    const task = await ownTask(user.id, id);
    if (!on) {
      await db.task.update({ where: { id }, data: { priority: null } });
      touch(task.goalId);
      return;
    }
    const date = task.date ?? toDbDate(todayISO(user.timezone));
    const taken = await db.task.findMany({
      where: { userId: user.id, date, priority: { not: null }, NOT: { id } },
      select: { priority: true },
    });
    const used = new Set(taken.map((t) => t.priority));
    const rank = [1, 2, 3].find((r) => !used.has(r));
    if (!rank) throw new UserError("PRIORITY_FULL");
    await db.task.update({ where: { id }, data: { priority: rank, date } });
    touch(task.goalId);
  });
}

// ---------- Daily plan ----------

const planSchema = z.object({
  intention: z.string().trim().max(400).nullable().optional(),
  energy: z.coerce.number().int().min(1).max(5).nullable().optional(),
});

export async function saveDailyPlan(date: ISODate, input: z.input<typeof planSchema>) {
  return run(async () => {
    const user = await requireUser();
    const d = toDbDate(isoDate.parse(date));
    const data = planSchema.parse(input);
    await db.dailyPlan.upsert({
      where: { userId_date: { userId: user.id, date: d } },
      update: data,
      create: { userId: user.id, date: d, ...data },
    });
    revalidatePath("/today");
    revalidatePath("/dashboard");
  });
}

// ---------- Focus ----------

const focusSchema = z.object({
  taskId: z.string().nullable().optional(),
  label: z.string().trim().max(160).nullable().optional(),
  plannedMinutes: z.number().int().min(1).max(240),
  actualMinutes: z.number().int().min(1).max(240),
  startedAt: z.string().datetime(),
  completed: z.boolean(),
});

export async function logFocusSession(input: z.input<typeof focusSchema>) {
  return run(async () => {
    const user = await requireUser();
    const d = focusSchema.parse(input);
    if (d.taskId) await ownTask(user.id, d.taskId);
    await db.focusSession.create({
      data: {
        userId: user.id,
        taskId: d.taskId ?? null,
        label: d.label ?? null,
        plannedMinutes: d.plannedMinutes,
        actualMinutes: d.actualMinutes,
        completed: d.completed,
        startedAt: new Date(d.startedAt),
        date: toDbDate(todayISO(user.timezone)),
      },
    });
    after(() => syncBadges(user.id));
    revalidatePath("/today");
    revalidatePath("/dashboard");
  });
}
