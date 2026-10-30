import "server-only";
import { db } from "@/lib/db";
import { ORDER_STATUSES, type OrderChannelFilter, type OrderStatus, type ProductStatus } from "@/lib/work-types";

export type { OrderStatus, OrderChannelFilter, ProductStatus } from "@/lib/work-types";
export { ORDER_STATUSES, PRODUCT_STATUSES } from "@/lib/work-types";

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

// ---------- Products ----------

export async function getWorkProducts(
  userId: string,
  opts: { search?: string; category?: string; status?: ProductStatus | "all"; sort?: "best" | "priceAsc" | "priceDesc" } = {},
) {
  const { search, category = "all", status = "all", sort = "best" } = opts;
  const q = search?.trim();
  return db.workProduct.findMany({
    where: {
      userId,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}),
      ...(category !== "all" ? { category } : {}),
      ...(status !== "all" ? { status } : {}),
    },
    orderBy: sort === "priceAsc" ? { priceCents: "asc" } : sort === "priceDesc" ? { priceCents: "desc" } : { soldCount: "desc" },
  });
}

export async function getWorkProductCategories(userId: string) {
  const rows = await db.workProduct.findMany({ where: { userId }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } });
  return rows.map((r) => r.category);
}

export async function getWorkProductStats(userId: string) {
  const all = await db.workProduct.findMany({
    where: { userId },
    select: { stock: true, reorderAt: true, costCents: true, priceCents: true, status: true, name: true },
  });
  const active = all.filter((p) => p.status === "ACTIVE");
  const stockValueCents = all.reduce((sum, p) => sum + p.stock * p.costCents, 0);
  const lowStock = active.filter((p) => p.stock > 0 && p.stock <= p.reorderAt);
  const outOfStock = active.filter((p) => p.stock === 0);
  const margins = active.filter((p) => p.priceCents > 0).map((p) => (p.priceCents - p.costCents) / p.priceCents);
  const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
  return {
    unitsOnHand: all.reduce((sum, p) => sum + p.stock, 0),
    stockValueCents,
    lowStockCount: lowStock.length,
    lowStockName: lowStock[0]?.name,
    outOfStockCount: outOfStock.length,
    outOfStockName: outOfStock[0]?.name,
    avgMargin,
    activeCount: active.length,
  };
}

// ---------- Analytics ----------

const DAY_MS = 86_400_000;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getWorkAnalytics(userId: string, opts: { days: number; channel?: OrderChannelFilter } = { days: 30 }) {
  const { days, channel = "all" } = opts;
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY_MS);
  const prevSince = new Date(now.getTime() - 2 * days * DAY_MS);

  const [orders, prevOrders, customerStats, products] = await Promise.all([
    db.workOrder.findMany({
      where: { userId, placedAt: { gte: since }, ...(channel !== "all" ? { channel: channel === "online" ? "ONLINE" : "IN_STORE" } : {}) },
      select: { totalCents: true, channel: true, placedAt: true },
    }),
    db.workOrder.findMany({
      where: { userId, placedAt: { gte: prevSince, lt: since }, ...(channel !== "all" ? { channel: channel === "online" ? "ONLINE" : "IN_STORE" } : {}) },
      select: { totalCents: true },
    }),
    getWorkStats(userId),
    db.workProduct.findMany({ where: { userId, status: "ACTIVE" }, orderBy: { soldCount: "desc" }, take: 6 }),
  ]);

  const revenueCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const orderCount = orders.length;
  const aovCents = orderCount ? Math.round(revenueCents / orderCount) : 0;
  const prevRevenueCents = prevOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const prevOrderCount = prevOrders.length;
  const prevAovCents = prevOrderCount ? Math.round(prevRevenueCents / prevOrderCount) : 0;
  const pctChange = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : cur > 0 ? 1 : 0);

  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) buckets.set(dayKey(new Date(now.getTime() - i * DAY_MS)), 0);
  for (const o of orders) {
    const key = dayKey(o.placedAt);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + o.totalCents);
  }
  const dailyRevenue = [...buckets.entries()].map(([key, value]) => ({
    key,
    label: new Date(key).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
    value: Math.round(value / 1000),
  }));

  const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const weekdayCount = new Array(7).fill(0) as number[];
  for (const o of orders) weekdayCount[o.placedAt.getDay()]! += 1;
  const weekdayOrders = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ key: String(d), label: weekdayLabels[d]!, value: weekdayCount[d]! }));

  const onlineOrders = orders.filter((o) => o.channel === "ONLINE");
  const inStoreOrders = orders.filter((o) => o.channel === "IN_STORE");
  const onlineRevenue = onlineOrders.reduce((s, o) => s + o.totalCents, 0);
  const inStoreRevenue = inStoreOrders.reduce((s, o) => s + o.totalCents, 0);
  const totalRevenue = onlineRevenue + inStoreRevenue;

  const topProducts = products.map((p) => ({ ...p, revenueCents: p.soldCount * p.priceCents }));

  return {
    revenueCents,
    orderCount,
    aovCents,
    revenueChange: pctChange(revenueCents, prevRevenueCents),
    orderChange: pctChange(orderCount, prevOrderCount),
    aovChange: pctChange(aovCents, prevAovCents),
    returningRate: customerStats.repeatRate,
    dailyRevenue,
    weekdayOrders,
    online: { orders: onlineOrders.length, revenueCents: onlineRevenue, share: totalRevenue ? onlineRevenue / totalRevenue : 0 },
    inStore: { orders: inStoreOrders.length, revenueCents: inStoreRevenue, share: totalRevenue ? inStoreRevenue / totalRevenue : 0 },
    topProducts,
  };
}
