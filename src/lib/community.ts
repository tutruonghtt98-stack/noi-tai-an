import "server-only";
import type { PostCategory, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const PAGE_SIZE = 10;
export const CATEGORIES: PostCategory[] = ["READING", "WORKOUT", "STUDY", "FOCUS", "GOAL", "OTHER"];

const authorSelect = { id: true, name: true, image: true, username: true, profilePublic: true } as const;

export type FeedFilter = {
  cursor?: string | null;
  category?: PostCategory | null;
  groupId?: string | null; // null = bảng tin công khai
  challengeId?: string | null;
  authorId?: string | null;
  followingOf?: string | null; // chỉ bài của những người mà user này đang theo dõi
};

/** Quyền xem: bài công khai, hoặc bài trong nhóm mà người xem là thành viên. */
export async function canViewGroup(viewerId: string | null, groupId: string) {
  if (!viewerId) return false;
  const m = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: viewerId } } });
  return !!m;
}

export async function getFeed(viewerId: string | null, f: FeedFilter) {
  const where: Prisma.PostWhereInput = {
    hiddenAt: null,
    groupId: f.groupId ?? null,
    ...(f.category ? { category: f.category } : {}),
    ...(f.challengeId ? { challengeId: f.challengeId } : {}),
    ...(f.authorId ? { userId: f.authorId } : {}),
    user: { bannedAt: null, ...(f.followingOf ? { followers: { some: { followerId: f.followingOf } } } : {}) },
  };
  const rows = await db.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
    include: {
      user: { select: authorSelect },
      challenge: { select: { id: true, title: true } },
      cheers: viewerId ? { where: { userId: viewerId }, select: { userId: true } } : false,
    },
  });
  const more = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE).map((p) => toPostView(p, viewerId));
  return { items, nextCursor: more ? items.at(-1)!.id : null };
}

type PostRow = Prisma.PostGetPayload<{
  include: { user: { select: typeof authorSelect }; challenge: { select: { id: true; title: true } } };
}> & { cheers?: { userId: string }[] | false };

export function toPostView(p: PostRow, viewerId: string | null) {
  return {
    id: p.id,
    kind: p.kind,
    category: p.category,
    content: p.content,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt.toISOString(),
    cheerCount: p.cheerCount,
    commentCount: p.commentCount,
    cheered: Array.isArray(p.cheers) && p.cheers.length > 0,
    mine: viewerId === p.userId,
    author: { id: p.user.id, name: p.user.name ?? "—", image: p.user.image, username: p.user.profilePublic ? p.user.username : null },
    challenge: p.challenge,
  };
}
export type PostView = ReturnType<typeof toPostView>;

/** Người có liên hệ theo dõi hai chiều/một chiều với user — dùng để mời vào thử thách. */
export async function getConnections(userId: string) {
  const rows = await db.follow.findMany({
    where: { OR: [{ followerId: userId }, { followingId: userId }] },
    include: {
      follower: { select: { id: true, name: true, image: true, bannedAt: true } },
      following: { select: { id: true, name: true, image: true, bannedAt: true } },
    },
  });
  const map = new Map<string, { id: string; name: string; image: string | null }>();
  for (const r of rows) {
    const p = r.followerId === userId ? r.following : r.follower;
    if (!p.bannedAt) map.set(p.id, { id: p.id, name: p.name ?? "—", image: p.image });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
}
export type Connection = Awaited<ReturnType<typeof getConnections>>[number];
