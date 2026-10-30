import "server-only";
import { db } from "@/lib/db";
import { ORDER_STATUSES, type OrderChannelFilter, type OrderStatus } from "@/lib/work-types";

export type { OrderStatus, OrderChannelFilter } from "@/lib/work-types";
export { ORDER_STATUSES } from "@/lib/work-types";

export type WorkFilter = "all" | "vip" | "wholesale" | "new" | "subscribers";
export type WorkSort = "spend" | "orders" | "recent";

const TAG_FOR_FILTER: Partial<Record<WorkFilter, string>> = {
  vip: "VIP",
  wholesale: "Bán sỉ",
  subscribers: "Đăng ký nhận tin",
};

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getWorkCustomers(userId: string, opts: { search?: string; filter?: WorkFilter; sort?: WorkSort } = {}) {
  const { search, filter = "all", sort = "spend" } = opts;
  const q = search?.trim();
  const tag = TAG_FOR_FILTER[filter];

  return db.workCustomer.findMany({
    where: {
      userId,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] } : {}),
      ...(filter === "new" ? { createdAt: { gte: startOfMonth() } } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
    },
    orderBy: sort === "orders" ? { orders: "desc" } : sort === "recent" ? { lastOrderAt: "desc" } : { lifetimeCents: "desc" },
  });
}

export async function getWorkStats(userId: string) {
  const all = await db.workCustomer.findMany({ where: { userId }, select: { channel: true, orders: true, lifetimeCents: true, createdAt: true, tags: true } });
  const total = all.length;
  const online = all.filter((c) => c.channel === "ONLINE").length;
  const inStore = total - online;
  const newThisMonth = all.filter((c) => c.createdAt >= startOfMonth()).length;
  const repeat = all.filter((c) => c.orders > 1).length;
  const repeatRate = total ? repeat / total : 0;
  const totalLifetimeCents = all.reduce((sum, c) => sum + c.lifetimeCents, 0);
  const avgLifetimeCents = total ? Math.round(totalLifetimeCents / total) : 0;
  const tagCount = (tag: string) => all.filter((c) => c.tags.includes(tag)).length;
  return {
    total,
    online,
    inStore,
    newThisMonth,
    repeatRate,
    totalLifetimeCents,
    avgLifetimeCents,
    vip: tagCount("VIP"),
    wholesale: tagCount("Bán sỉ"),
    subscribers: tagCount("Đăng ký nhận tin"),
  };
}

// ---------- Workspace (Kanban) ----------

export const DEFAULT_LISTS: { name: string; color: string }[] = [
  { name: "listToDo", color: "muted" },
  { name: "listInProgress", color: "mist" },
  { name: "listReview", color: "ochre" },
  { name: "listDone", color: "jade" },
];

export async function getWorkBoards(userId: string) {
  return db.workBoard.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    include: {
      lists: {
        orderBy: { sortOrder: "asc" },
        include: { cards: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
}

export type WorkBoardWithLists = Awaited<ReturnType<typeof getWorkBoards>>[number];

// ---------- Orders ----------

export async function getWorkOrders(
  userId: string,
  opts: { search?: string; status?: OrderStatus | "all"; channel?: OrderChannelFilter; sort?: "recent" | "total" } = {},
) {
  const { search, status = "all", channel = "all", sort = "recent" } = opts;
  const q = search?.trim();
  return db.workOrder.findMany({
    where: {
      userId,
      ...(q ? { OR: [{ customerName: { contains: q, mode: "insensitive" } }, { customerCity: { contains: q, mode: "insensitive" } }] } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(channel !== "all" ? { channel: channel === "online" ? "ONLINE" : "IN_STORE" } : {}),
    },
    orderBy: sort === "total" ? { totalCents: "desc" } : { placedAt: "desc" },
  });
}

export async function getWorkOrderStats(userId: string) {
  const all = await db.workOrder.findMany({
    where: { userId },
    select: { status: true, totalCents: true, refundedCents: true, refundedAt: true },
  });
  const total = all.length;
  const open = all.filter((o) => o.status !== "CLOSED").length;
  const awaitingPayment = all.filter((o) => o.status === "PENDING").length;
  const toShip = all.filter((o) => o.status === "PAID" || o.status === "PACKED").length;
  const packed = all.filter((o) => o.status === "PACKED").length;
  const toPack = all.filter((o) => o.status === "PAID").length;
  const totalValueCents = all.reduce((sum, o) => sum + o.totalCents, 0);
  const avgOrderCents = total ? Math.round(totalValueCents / total) : 0;
  const month = startOfMonth();
  const refundsThisMonth = all.filter((o) => o.refundedAt && o.refundedAt >= month).reduce((sum, o) => sum + o.refundedCents, 0);
  const refundCount = all.filter((o) => o.refundedAt && o.refundedAt >= month).length;
  const statusCount = (s: OrderStatus) => all.filter((o) => o.status === s).length;
  return {
    total,
    open,
    awaitingPayment,
    toShip,
    packed,
    toPack,
    avgOrderCents,
    refundsThisMonth,
    refundCount,
    byStatus: Object.fromEntries(ORDER_STATUSES.map((s) => [s, statusCount(s)])) as Record<OrderStatus, number>,
  };
}
