"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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
