import "server-only";
import { db } from "@/lib/db";
import { getUserTeamIds } from "@/lib/department-queries";

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
  { name: "listOverdue", color: "danger" },
];

export type BoardAccess = "owner" | "member";

/** Bảng mà user sở hữu, được gắn làm người phụ trách bảng, thuộc team phụ trách bảng, hoặc có ít nhất
 * một thẻ được cấp quyền riêng (card.assigneeUserId / card.teamId) — để thẻ được giao luôn hiện ra ngay
 * dưới đúng tên bảng của người tạo, không cần một mục "Được giao cho tôi" riêng.
 * Chủ bảng xem/thao tác toàn quyền; người phụ trách và thành viên team phụ trách chỉ xem/thao tác được
 * đúng những thẻ mà chủ bảng đã cấp quyền trực tiếp (card.assigneeUserId) hoặc cấp cho team của họ (card.teamId). */
export async function getAccessibleBoards(userId: string) {
  const teamIds = await getUserTeamIds(userId);
  const cardGrant = { OR: [{ assigneeUserId: userId }, ...(teamIds.length ? [{ teamId: { in: teamIds } }] : [])] };
  const boards = await db.workBoard.findMany({
    where: {
      OR: [{ userId }, { assigneeUserId: userId }, ...(teamIds.length ? [{ teamId: { in: teamIds } }] : []), { lists: { some: { cards: { some: cardGrant } } } }],
    },
    orderBy: { sortOrder: "asc" },
    include: {
      user: { select: { id: true, name: true, image: true } },
      lists: {
        orderBy: { sortOrder: "asc" },
        include: { cards: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  return boards.map((b) => {
    const access: BoardAccess = b.userId === userId ? "owner" : "member";
    if (access === "owner") return { ...b, access };
    return {
      ...b,
      access,
      lists: b.lists.map((l) => ({
        ...l,
        cards: l.cards.filter((c) => c.assigneeUserId === userId || (c.teamId && teamIds.includes(c.teamId))),
      })),
    };
  });
}

export type WorkBoardWithLists = Awaited<ReturnType<typeof getAccessibleBoards>>[number];

// ---------- Báo cáo hoàn thành công việc ----------

export type CompletionBucket = "early" | "onTime" | "late" | "noDeadline";

function completionBucket(dueDate: Date | null, completedAt: Date): CompletionBucket {
  if (!dueDate) return "noDeadline";
  const due = dueDate.toISOString().slice(0, 10);
  const done = completedAt.toISOString().slice(0, 10);
  if (done < due) return "early";
  if (done === due) return "onTime";
  return "late";
}

const DAY_MS = 86_400_000;

export async function getWorkCompletionReport(userId: string, opts: { days?: number } = {}) {
  const { days = 30 } = opts;
  const since = new Date(Date.now() - days * DAY_MS);

  const [cards, openCount] = await Promise.all([
    db.workCard.findMany({
      where: { completedAt: { gte: since }, list: { board: { userId } } },
      select: { id: true, title: true, dueDate: true, completedAt: true, list: { select: { board: { select: { id: true, name: true } } } } },
      orderBy: { completedAt: "desc" },
    }),
    db.workCard.count({ where: { completedAt: null, list: { board: { userId } } } }),
  ]);

  const buckets: Record<CompletionBucket, number> = { early: 0, onTime: 0, late: 0, noDeadline: 0 };
  const byBoard = new Map<string, { name: string; scheduled: number; onTime: number }>();
  const rows = cards.map((c) => {
    const bucket = completionBucket(c.dueDate, c.completedAt!);
    buckets[bucket]++;
    const boardId = c.list.board.id;
    const entry = byBoard.get(boardId) ?? { name: c.list.board.name, scheduled: 0, onTime: 0 };
    if (bucket !== "noDeadline") {
      entry.scheduled++;
      if (bucket !== "late") entry.onTime++;
    }
    byBoard.set(boardId, entry);
    return { id: c.id, title: c.title, board: c.list.board.name, dueDate: c.dueDate, completedAt: c.completedAt!, bucket };
  });

  const scheduled = buckets.early + buckets.onTime + buckets.late;
  const onTimeRate = scheduled ? (buckets.early + buckets.onTime) / scheduled : 0;

  const dayBuckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) dayBuckets.set(new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10), 0);
  for (const c of cards) {
    const key = c.completedAt!.toISOString().slice(0, 10);
    if (dayBuckets.has(key)) dayBuckets.set(key, dayBuckets.get(key)! + 1);
  }
  const dailyCompletions = [...dayBuckets.entries()].map(([key, value]) => ({
    key,
    label: new Date(key).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
    value,
  }));

  const byBoardRate = [...byBoard.values()]
    .filter((b) => b.scheduled > 0)
    .map((b) => ({ id: b.name, label: b.name, value: b.onTime / b.scheduled, note: `${b.onTime}/${b.scheduled}` }))
    .sort((a, b) => b.value - a.value);

  return { total: cards.length, buckets, onTimeRate, openCount, rows: rows.slice(0, 30), dailyCompletions, byBoardRate };
}

// ---------- Bình luận thẻ ----------

export async function getCardComments(cardId: string) {
  return db.workCardComment.findMany({
    where: { cardId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, image: true } } },
  });
}
