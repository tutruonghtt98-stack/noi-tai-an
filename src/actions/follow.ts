"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";

/** Theo dõi / bỏ theo dõi một hồ sơ (chỉ hồ sơ công khai). */
export async function toggleFollow(targetId: string) {
  return run(async () => {
    const user = await requireUser();
    if (targetId === user.id) throw new UserError("SELF");
    rateLimit(`follow:${user.id}`, 100, 3600_000);
    const target = await db.user.findUnique({ where: { id: targetId }, select: { profilePublic: true, bannedAt: true, username: true } });
    if (!target || target.bannedAt || !target.profilePublic) throw new UserError("NOT_FOUND");
    const key = { followerId_followingId: { followerId: user.id, followingId: targetId } };
    const existing = await db.follow.findUnique({ where: key });
    if (existing) await db.follow.delete({ where: key });
    else await db.follow.create({ data: { followerId: user.id, followingId: targetId } });
    if (target.username) revalidatePath(`/u/${target.username}`);
    revalidatePath("/community");
    return { following: !existing };
  });
}
