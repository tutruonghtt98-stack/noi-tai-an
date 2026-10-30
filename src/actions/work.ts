"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { DEFAULT_LISTS } from "@/lib/work-queries";
import type { Prisma } from "@/generated/prisma/client";

const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  city: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null),
  channel: z.enum(["ONLINE", "IN_STORE"]),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
export type CustomerInput = z.input<typeof customerSchema>;

export async function createWorkCustomer(input: CustomerInput) {
  return run(async () => {
    const user = await requireUser();
    const data = customerSchema.parse(input);
    await db.workCustomer.create({ data: { ...data, userId: user.id } });
    revalidatePath("/work/customers");
  });
}

export async function deleteWorkCustomer(id: string) {
  return run(async () => {
    const user = await requireUser();
    const row = await db.workCustomer.findUnique({ where: { id }, select: { userId: true } });
    if (!row || row.userId !== user.id) throw new UserError("VALIDATION");
    await db.workCustomer.delete({ where: { id } });
    revalidatePath("/work/customers");
  });
}

// ---------- Workspace (Kanban) ----------

const boardSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
});
export type BoardInput = z.input<typeof boardSchema>;

export async function createWorkBoard(input: BoardInput) {
  return run(async () => {
    const user = await requireUser();
    const data = boardSchema.parse(input);
    const count = await db.workBoard.count({ where: { userId: user.id } });
    const board = await db.workBoard.create({
      data: {
        ...data,
        userId: user.id,
        sortOrder: count,
        lists: {
          create: DEFAULT_LISTS.map((l, i) => ({ name: l.name, color: l.color, sortOrder: i })),
        },
      },
    });
    revalidatePath("/work/workspace");
    return board.id;
  });
}

export async function deleteWorkBoard(id: string) {
  return run(async () => {
    const user = await requireUser();
    const row = await db.workBoard.findUnique({ where: { id }, select: { userId: true } });
    if (!row || row.userId !== user.id) throw new UserError("VALIDATION");
    await db.workBoard.delete({ where: { id } });
    revalidatePath("/work/workspace");
  });
}

const cardSchema = z.object({
  listId: z.string().min(1),
  label: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => v || null),
  title: z.string().trim().min(1).max(160),
  assignee: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => v || null),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
});
export type CardInput = z.input<typeof cardSchema>;

export async function createWorkCard(input: CardInput) {
  return run(async () => {
    const user = await requireUser();
    const data = cardSchema.parse(input);
    const list = await db.workList.findUnique({ where: { id: data.listId }, select: { board: { select: { userId: true } } } });
    if (!list || list.board.userId !== user.id) throw new UserError("VALIDATION");
    const count = await db.workCard.count({ where: { listId: data.listId } });
    await db.workCard.create({ data: { ...data, sortOrder: count, checklist: [] } });
    revalidatePath("/work/workspace");
  });
}

const cardUpdateSchema = cardSchema;
export type CardUpdateInput = z.input<typeof cardUpdateSchema>;

export async function updateWorkCard(id: string, input: CardUpdateInput) {
  return run(async () => {
    const user = await requireUser();
    const data = cardUpdateSchema.parse(input);
    const card = await db.workCard.findUnique({ where: { id }, select: { listId: true, list: { select: { board: { select: { userId: true } } } } } });
    if (!card || card.list.board.userId !== user.id) throw new UserError("VALIDATION");
    const targetList = await db.workList.findUnique({ where: { id: data.listId }, select: { board: { select: { userId: true } } } });
    if (!targetList || targetList.board.userId !== user.id) throw new UserError("VALIDATION");
    const changingList = data.listId !== card.listId;
    const sortOrder = changingList ? await db.workCard.count({ where: { listId: data.listId } }) : undefined;
    await db.workCard.update({ where: { id }, data: { ...data, ...(sortOrder != null ? { sortOrder } : {}) } });
    revalidatePath("/work/workspace");
  });
}

const checklistItemSchema = z.object({ id: z.string().min(1), text: z.string().trim().min(1).max(200), done: z.boolean() });

export async function updateWorkCardChecklist(id: string, checklist: { id: string; text: string; done: boolean }[]) {
  return run(async () => {
    const user = await requireUser();
    const card = await db.workCard.findUnique({ where: { id }, select: { list: { select: { board: { select: { userId: true } } } } } });
    if (!card || card.list.board.userId !== user.id) throw new UserError("VALIDATION");
    const parsed = z.array(checklistItemSchema).max(50).parse(checklist);
    await db.workCard.update({ where: { id }, data: { checklist: parsed as Prisma.InputJsonValue } });
    revalidatePath("/work/workspace");
  });
}

export async function moveWorkCard(id: string, toListId: string) {
  return run(async () => {
    const user = await requireUser();
    const card = await db.workCard.findUnique({ where: { id }, select: { list: { select: { board: { select: { userId: true } } } } } });
    if (!card || card.list.board.userId !== user.id) throw new UserError("VALIDATION");
    const toList = await db.workList.findUnique({ where: { id: toListId }, select: { board: { select: { userId: true } } } });
    if (!toList || toList.board.userId !== user.id) throw new UserError("VALIDATION");
    const count = await db.workCard.count({ where: { listId: toListId } });
    await db.workCard.update({ where: { id }, data: { listId: toListId, sortOrder: count } });
    revalidatePath("/work/workspace");
  });
}

export async function deleteWorkCard(id: string) {
  return run(async () => {
    const user = await requireUser();
    const card = await db.workCard.findUnique({ where: { id }, select: { list: { select: { board: { select: { userId: true } } } } } });
    if (!card || card.list.board.userId !== user.id) throw new UserError("VALIDATION");
    await db.workCard.delete({ where: { id } });
    revalidatePath("/work/workspace");
  });
}
