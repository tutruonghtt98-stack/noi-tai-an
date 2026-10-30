"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { DEFAULT_LISTS, ORDER_STATUSES, PRODUCT_STATUSES } from "@/lib/work-queries";

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
  checklistTotal: z.number().int().min(0).max(99).default(0),
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
    await db.workCard.create({ data: { ...data, sortOrder: count } });
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

// ---------- Orders ----------

const orderSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  customerCity: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null),
  channel: z.enum(["ONLINE", "IN_STORE"]),
  items: z.number().int().min(1).max(999).default(1),
  totalCents: z.number().int().min(0).default(0),
  payment: z.string().trim().min(1).max(40),
  status: z.enum(ORDER_STATUSES as [string, ...string[]]),
});
export type OrderInput = z.input<typeof orderSchema>;

export async function createWorkOrder(input: OrderInput) {
  return run(async () => {
    const user = await requireUser();
    const data = orderSchema.parse(input);
    const count = await db.workOrder.count({ where: { userId: user.id } });
    await db.workOrder.create({ data: { ...data, userId: user.id, orderNo: 10000 + count } });
    revalidatePath("/work/orders");
  });
}

export async function updateWorkOrderStatus(id: string, status: string) {
  return run(async () => {
    const user = await requireUser();
    const order = await db.workOrder.findUnique({ where: { id }, select: { userId: true } });
    if (!order || order.userId !== user.id) throw new UserError("VALIDATION");
    if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) throw new UserError("VALIDATION");
    await db.workOrder.update({ where: { id }, data: { status } });
    revalidatePath("/work/orders");
  });
}

export async function deleteWorkOrder(id: string) {
  return run(async () => {
    const user = await requireUser();
    const order = await db.workOrder.findUnique({ where: { id }, select: { userId: true } });
    if (!order || order.userId !== user.id) throw new UserError("VALIDATION");
    await db.workOrder.delete({ where: { id } });
    revalidatePath("/work/orders");
  });
}

// ---------- Products ----------

const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().min(1).max(40),
  category: z.string().trim().min(1).max(40),
  priceCents: z.number().int().min(0).default(0),
  costCents: z.number().int().min(0).default(0),
  stock: z.number().int().min(0).max(999_999).default(0),
  reorderAt: z.number().int().min(0).max(999_999).default(0),
  status: z.enum(PRODUCT_STATUSES as [string, ...string[]]).default("ACTIVE"),
});
export type ProductInput = z.input<typeof productSchema>;

export async function createWorkProduct(input: ProductInput) {
  return run(async () => {
    const user = await requireUser();
    const data = productSchema.parse(input);
    await db.workProduct.create({ data: { ...data, userId: user.id } });
    revalidatePath("/work/products");
  });
}

export async function updateWorkProductStatus(id: string, status: string) {
  return run(async () => {
    const user = await requireUser();
    const product = await db.workProduct.findUnique({ where: { id }, select: { userId: true } });
    if (!product || product.userId !== user.id) throw new UserError("VALIDATION");
    if (!PRODUCT_STATUSES.includes(status as (typeof PRODUCT_STATUSES)[number])) throw new UserError("VALIDATION");
    await db.workProduct.update({ where: { id }, data: { status } });
    revalidatePath("/work/products");
  });
}

export async function deleteWorkProduct(id: string) {
  return run(async () => {
    const user = await requireUser();
    const product = await db.workProduct.findUnique({ where: { id }, select: { userId: true } });
    if (!product || product.userId !== user.id) throw new UserError("VALIDATION");
    await db.workProduct.delete({ where: { id } });
    revalidatePath("/work/products");
  });
}
