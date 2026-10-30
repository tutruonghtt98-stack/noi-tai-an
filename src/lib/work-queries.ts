import "server-only";
import { db } from "@/lib/db";

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
