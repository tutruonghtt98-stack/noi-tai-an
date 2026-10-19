"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";
import { ALLOWED_TYPES, deleteObject, MAX_UPLOAD_BYTES, newKey, ownsKey, presignPut, publicUrlFor, storageMode, verifyUploaded } from "@/lib/storage";
import { canViewGroup, getFeed, CATEGORIES } from "@/lib/community";
import { syncBadges } from "@/lib/badges";

/** Xin quyền tải ảnh: trả về URL ký sẵn (R2) hoặc endpoint local khi phát triển. */
export async function requestUpload(input: { contentType: string; size: number; purpose?: "posts" | "avatars" }) {
  return run(async () => {
    const user = await requireUser();
    rateLimit(`upload:${user.id}`, 30, 3600_000);
    const contentType = z.enum(ALLOWED_TYPES).parse(input.contentType);
    const size = z.number().int().min(1).max(MAX_UPLOAD_BYTES).parse(input.size);
    const key = newKey(user.id, contentType, input.purpose === "avatars" ? "avatars" : "posts");
    if (storageMode() === "local") return { key, url: `/api/uploads/${key}`, mode: "local" as const };
    return { key, url: await presignPut(key, contentType, size), mode: "r2" as const };
  });
}

const postSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  category: z.enum(CATEGORIES as [string, ...string[]]),
  imageKey: z.string().max(200).nullable().optional(),
  groupId: z.string().nullable().optional(),
  challengeId: z.string().nullable().optional(),
  kind: z.enum(["POST", "CHECKIN", "SUMMARY"]).default("POST"),
});

export async function createPost(input: z.input<typeof postSchema>) {
  return run(async () => {
    const user = await requireUser();
    rateLimit(`post:${user.id}`, 20, 3600_000);
    const d = postSchema.parse(input);
    if (d.groupId && !(await canViewGroup(user.id, d.groupId))) throw new UserError("FORBIDDEN");
    if (d.challengeId) {
      const m = await db.challengeMember.findUnique({ where: { challengeId_userId: { challengeId: d.challengeId, userId: user.id } } });
      if (!m) throw new UserError("FORBIDDEN");
    }
    let imageUrl: string | null = null;
    if (d.imageKey) {
      if (!ownsKey(user.id, d.imageKey, "posts") || !(await verifyUploaded(d.imageKey))) throw new UserError("BAD_IMAGE");
      imageUrl = publicUrlFor(d.imageKey);
    }
    await db.post.create({
      data: {
        userId: user.id,
        content: d.content,
        category: d.category as "OTHER",
        kind: d.kind,
        imageKey: d.imageKey ?? null,
        imageUrl,
        groupId: d.groupId ?? null,
        challengeId: d.challengeId ?? null,
      },
    });
    after(() => syncBadges(user.id));
    revalidatePath("/community", "layout");
  });
}

export async function deletePost(id: string) {
  return run(async () => {
    const user = await requireUser();
    const post = await db.post.findUnique({ where: { id } });
    if (!post) throw new UserError("NOT_FOUND");
    if (post.userId !== user.id && user.role !== "ADMIN") throw new UserError("FORBIDDEN");
    await db.post.delete({ where: { id } });
    if (post.imageKey) after(() => deleteObject(post.imageKey!));
    revalidatePath("/community", "layout");
  });
}

async function assertCanSee(userId: string, postId: string) {
  const post = await db.post.findUnique({ where: { id: postId }, select: { groupId: true, hiddenAt: true } });
  if (!post || post.hiddenAt) throw new UserError("NOT_FOUND");
  if (post.groupId && !(await canViewGroup(userId, post.groupId))) throw new UserError("FORBIDDEN");
}

export async function toggleCheer(postId: string) {
  return run(async () => {
    const user = await requireUser();
    rateLimit(`cheer:${user.id}`, 200, 3600_000);
    await assertCanSee(user.id, postId);
    const key = { postId_userId: { postId, userId: user.id } };
    const existing = await db.cheer.findUnique({ where: key });
    if (existing) {
      await db.$transaction([db.cheer.delete({ where: key }), db.post.update({ where: { id: postId }, data: { cheerCount: { decrement: 1 } } })]);
    } else {
      await db.$transaction([db.cheer.create({ data: { postId, userId: user.id } }), db.post.update({ where: { id: postId }, data: { cheerCount: { increment: 1 } } })]);
      after(() => syncBadges(user.id));
    }
    return { cheered: !existing };
  });
}

export async function listComments(postId: string) {
  return run(async () => {
    const user = await requireUser();
    await assertCanSee(user.id, postId);
    const rows = await db.comment.findMany({
      where: { postId, hiddenAt: null, user: { bannedAt: null } },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { user: { select: { id: true, name: true, image: true } } },
    });
    return rows.map((c) => ({ id: c.id, content: c.content, createdAt: c.createdAt.toISOString(), mine: c.userId === user.id, author: { name: c.user.name ?? "—", image: c.user.image } }));
  });
}

export async function addComment(postId: string, content: string) {
  return run(async () => {
    const user = await requireUser();
    rateLimit(`comment:${user.id}`, 60, 3600_000);
    await assertCanSee(user.id, postId);
    const text = z.string().trim().min(1).max(1000).parse(content);
    await db.$transaction([
      db.comment.create({ data: { postId, userId: user.id, content: text } }),
      db.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
    ]);
  });
}

export async function deleteComment(id: string) {
  return run(async () => {
    const user = await requireUser();
    const c = await db.comment.findUnique({ where: { id } });
    if (!c) throw new UserError("NOT_FOUND");
    if (c.userId !== user.id && user.role !== "ADMIN") throw new UserError("FORBIDDEN");
    await db.$transaction([db.comment.delete({ where: { id } }), db.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } })]);
  });
}

export async function reportContent(input: { postId?: string; commentId?: string; reason: string }) {
  return run(async () => {
    const user = await requireUser();
    rateLimit(`report:${user.id}`, 20, 3600_000);
    const reason = z.string().trim().min(1).max(300).parse(input.reason);
    if (!input.postId && !input.commentId) throw new UserError("VALIDATION");
    await db.report.create({ data: { reporterId: user.id, postId: input.postId ?? null, commentId: input.commentId ?? null, reason } });
  });
}

/** Phân trang bảng tin (nút "Xem thêm"). */
export async function loadFeed(input: { cursor: string; category?: string | null; groupId?: string | null; challengeId?: string | null; authorId?: string | null; following?: boolean }) {
  return run(async () => {
    const user = await requireUser();
    if (input.groupId && !(await canViewGroup(user.id, input.groupId))) throw new UserError("FORBIDDEN");
    const category = input.category && (CATEGORIES as string[]).includes(input.category) ? (input.category as "OTHER") : null;
    return getFeed(user.id, { cursor: input.cursor, category, groupId: input.groupId ?? null, challengeId: input.challengeId ?? null, authorId: input.authorId ?? null, followingOf: input.following ? user.id : null });
  });
}
