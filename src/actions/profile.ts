"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { deleteObject, ownsKey, publicUrlFor, verifyUploaded } from "@/lib/storage";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";

const RESERVED = new Set(["admin", "api", "login", "settings", "community", "pricing", "support", "noitaian", "root", "me"]);

const schema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/)
    .refine((u) => !RESERVED.has(u)),
  bio: z.string().trim().max(280).optional().transform((v) => v || null),
  profilePublic: z.boolean(),
  showGoals: z.boolean(),
  showStats: z.boolean(),
  showBadges: z.boolean(),
  showChallenges: z.boolean(),
  leaderboardOptIn: z.boolean(),
  autoShareAchievements: z.boolean(),
});
export type JourneyInput = z.input<typeof schema>;

export async function updateJourney(input: JourneyInput) {
  return run(async () => {
    const user = await requireUser();
    const d = schema.parse(input);
    try {
      await db.user.update({ where: { id: user.id }, data: d });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new UserError("USERNAME_TAKEN");
      throw e;
    }
    revalidatePath("/settings");
    revalidatePath(`/u/${d.username}`);
    if (user.username && user.username !== d.username) revalidatePath(`/u/${user.username}`);
    revalidatePath("/community", "layout");
  });
}

/** Đặt ảnh đại diện từ ảnh đã tải lên (key) — hoặc null để quay về ảnh mặc định. */
export async function setAvatar(key: string | null) {
  return run(async () => {
    const user = await requireUser();
    let image: string | null = null;
    if (key) {
      if (!ownsKey(user.id, key, "avatars") || !(await verifyUploaded(key))) throw new UserError("BAD_IMAGE");
      image = publicUrlFor(key);
    }
    const old = user.image;
    await db.user.update({ where: { id: user.id }, data: { image } });
    // Xoá ảnh cũ do mình tải lên (không đụng ảnh Google)
    const prefix = publicUrlFor(`avatars/${user.id}/`);
    if (old && old.startsWith(prefix)) after(() => deleteObject(old.slice(publicUrlFor("").length)));
    revalidatePath("/", "layout");
  });
}
