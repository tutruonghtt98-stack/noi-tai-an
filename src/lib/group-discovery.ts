import "server-only";
import type { PostCategory, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type GroupCard = {
  id: string;
  name: string;
  description: string | null;
  category: PostCategory | null;
  city: string | null;
  members: number;
  maxMembers: number;
  lastActiveDays: number | null;
  distanceKm: number | null;
  status: "member" | "pending" | "open" | "full";
  reasons: ("category" | "city" | "active" | "slots")[];
};

/** Khoảng cách đường chim bay (km) — công thức Haversine. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const groupSelect = {
  id: true,
  name: true,
  description: true,
  category: true,
  city: true,
  lat: true,
  lng: true,
  maxMembers: true,
  _count: { select: { members: true } },
} satisfies Prisma.GroupSelect;
type Row = Prisma.GroupGetPayload<{ select: typeof groupSelect }>;

async function decorate(viewerId: string, rows: Row[]) {
  const ids = rows.map((r) => r.id);
  const [mine, pending, activity] = await Promise.all([
    db.groupMember.findMany({ where: { userId: viewerId, groupId: { in: ids } }, select: { groupId: true } }),
    db.groupJoinRequest.findMany({ where: { userId: viewerId, status: "PENDING", groupId: { in: ids } }, select: { groupId: true } }),
    db.post.groupBy({ by: ["groupId"], where: { groupId: { in: ids } }, _max: { createdAt: true } }),
  ]);
  const memberOf = new Set(mine.map((m) => m.groupId));
  const pendingOf = new Set(pending.map((p) => p.groupId));
  const last = new Map(activity.map((a) => [a.groupId, a._max.createdAt]));
  return (r: Row): Omit<GroupCard, "distanceKm" | "reasons"> => {
    const l = last.get(r.id);
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      city: r.city,
      members: r._count.members,
      maxMembers: r.maxMembers,
      lastActiveDays: l ? Math.floor((Date.now() - l.getTime()) / 86_400_000) : null,
      status: memberOf.has(r.id) ? "member" : pendingOf.has(r.id) ? "pending" : r._count.members >= r.maxMembers ? "full" : "open",
    };
  };
}

/** Gợi ý nhóm công khai dựa trên chủ đề người dùng quan tâm, độ năng động và chỗ trống. */
export async function suggestGroups(viewerId: string, limit = 6): Promise<GroupCard[]> {
  const [posts, challenges, myGroups] = await Promise.all([
    db.post.groupBy({ by: ["category"], where: { userId: viewerId }, _count: true }),
    db.challengeMember.findMany({ where: { userId: viewerId }, select: { challenge: { select: { category: true } } } }),
    db.groupMember.findMany({ where: { userId: viewerId }, select: { group: { select: { city: true } } } }),
  ]);
  const interest = new Map<PostCategory, number>();
  for (const p of posts) interest.set(p.category, (interest.get(p.category) ?? 0) + p._count);
  for (const c of challenges) interest.set(c.challenge.category, (interest.get(c.challenge.category) ?? 0) + 2);
  const cities = new Set(myGroups.map((g) => g.group.city?.toLowerCase().trim()).filter(Boolean));

  const rows = await db.group.findMany({
    where: { isPublic: true, members: { none: { userId: viewerId } } },
    select: groupSelect,
    take: 200,
    orderBy: { updatedAt: "desc" },
  });
  const deco = await decorate(viewerId, rows);
  return rows
    .map((r) => {
      const card = deco(r);
      const reasons: GroupCard["reasons"] = [];
      let score = 0;
      if (r.category && interest.has(r.category)) {
        score += 3 + Math.min(3, interest.get(r.category)!);
        reasons.push("category");
      }
      if (r.city && cities.has(r.city.toLowerCase().trim())) {
        score += 3;
        reasons.push("city");
      }
      if (card.lastActiveDays != null && card.lastActiveDays <= 3) {
        score += 2;
        reasons.push("active");
      } else if (card.lastActiveDays != null && card.lastActiveDays <= 7) score += 1;
      if (card.status === "open") {
        score += 1;
        reasons.push("slots");
      } else score -= 5;
      return { card: { ...card, distanceKm: null, reasons }, score };
    })
    .filter((x) => x.card.status !== "full")
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.card);
}

/** Tìm nhóm công khai theo từ khoá và/hoặc vị trí (bán kính km). Vị trí người tìm KHÔNG được lưu. */
export async function searchGroups(
  viewerId: string,
  opts: { q?: string; lat?: number | null; lng?: number | null; radiusKm?: number },
): Promise<GroupCard[]> {
  const q = opts.q?.trim();
  const rows = await db.group.findMany({
    where: {
      isPublic: true,
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] }
        : {}),
      ...(opts.lat != null ? { lat: { not: null }, lng: { not: null } } : {}),
    },
    select: groupSelect,
    take: 300,
    orderBy: { updatedAt: "desc" },
  });
  const deco = await decorate(viewerId, rows);
  const me = opts.lat != null && opts.lng != null ? { lat: opts.lat, lng: opts.lng } : null;
  return rows
    .map((r) => ({ ...deco(r), reasons: [] as GroupCard["reasons"], distanceKm: me && r.lat != null && r.lng != null ? haversineKm(me, { lat: r.lat, lng: r.lng }) : null }))
    .filter((c) => !me || (c.distanceKm != null && c.distanceKm <= (opts.radiusKm ?? 10)))
    .sort((a, b) => (me ? a.distanceKm! - b.distanceKm! : (a.lastActiveDays ?? 999) - (b.lastActiveDays ?? 999)))
    .slice(0, 30);
}
