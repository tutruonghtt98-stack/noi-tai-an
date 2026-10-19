"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { limitsFor } from "@/lib/plan";
import { rateLimit } from "@/lib/rate-limit";
import { addDays, isValidISO, toDbDate, todayISO } from "@/lib/dates";
import { challengeWindow, completionTarget } from "@/lib/challenges";
import { award, syncBadges } from "@/lib/badges";

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  category: z.enum(["READING", "WORKOUT", "STUDY", "FOCUS", "GOAL", "OTHER"]),
  durationDays: z.union([z.literal(7), z.literal(21), z.literal(30)]),
  startDate: z.string().refine(isValidISO),
  official: z.boolean().default(false),
  badgeName: z.string().trim().max(60).optional().transform((v) => v || null),
});

export async function createChallenge(input: z.input<typeof schema>) {
  return run(async () => {
    const user = await requireUser();
    const d = schema.parse(input);
    const isAdmin = user.role === "ADMIN";
    if (!isAdmin && !limitsFor(user).createChallenges) throw new UserError("PRO_ONLY");
    rateLimit(`challenge:${user.id}`, 5, 86_400_000);
    const today = todayISO(user.timezone);
    if (d.startDate < today || d.startDate > addDays(today, 60)) throw new UserError("VALIDATION");
    const c = await db.challenge.create({
      data: {
        creatorId: user.id,
        title: d.title,
        description: d.description,
        category: d.category,
        durationDays: d.durationDays,
        startDate: toDbDate(d.startDate),
        official: isAdmin && d.official,
        badgeName: isAdmin ? d.badgeName : null,
        members: { create: { userId: user.id } },
      },
    });
    revalidatePath("/community/challenges");
    revalidatePath("/admin/challenges");
    return { id: c.id };
  });
}

export async function joinChallenge(id: string) {
  return run(async () => {
    const user = await requireUser();
    const c = await db.challenge.findFirst({ where: { id, archivedAt: null } });
    if (!c) throw new UserError("NOT_FOUND");
    if (challengeWindow(c, todayISO(user.timezone)).state === "ended") throw new UserError("ENDED");
    await db.challengeMember.upsert({
      where: { challengeId_userId: { challengeId: id, userId: user.id } },
      update: {},
      create: { challengeId: id, userId: user.id },
    });
    revalidatePath(`/community/challenges/${id}`);
    revalidatePath("/community", "layout");
  });
}

export async function leaveChallenge(id: string) {
  return run(async () => {
    const user = await requireUser();
    await db.challengeMember.deleteMany({ where: { challengeId: id, userId: user.id, completedAt: null } });
    revalidatePath(`/community/challenges/${id}`);
    revalidatePath("/community", "layout");
  });
}

export async function checkinChallenge(id: string, input: { note?: string; share?: boolean }) {
  return run(async () => {
    const user = await requireUser();
    rateLimit(`checkin:${user.id}`, 30, 3600_000);
    const note = z.string().trim().max(500).optional().parse(input.note) || null;
    const c = await db.challenge.findFirst({ where: { id, archivedAt: null } });
    if (!c) throw new UserError("NOT_FOUND");
    const member = await db.challengeMember.findUnique({ where: { challengeId_userId: { challengeId: id, userId: user.id } } });
    if (!member) throw new UserError("FORBIDDEN");
    const today = todayISO(user.timezone);
    const w = challengeWindow(c, today);
    if (w.state === "upcoming") throw new UserError("NOT_STARTED");
    if (w.state === "ended") throw new UserError("ENDED");

    await db.challengeCheckin.upsert({
      where: { challengeId_userId_date: { challengeId: id, userId: user.id, date: toDbDate(today) } },
      update: { note },
      create: { challengeId: id, userId: user.id, date: toDbDate(today), note },
    });
    if (input.share && note) {
      await db.post.create({ data: { userId: user.id, kind: "CHECKIN", category: c.category, content: note, challengeId: id } });
    }

    let completed = false;
    if (!member.completedAt) {
      const count = await db.challengeCheckin.count({ where: { challengeId: id, userId: user.id } });
      if (count >= completionTarget(c.durationDays)) {
        await db.challengeMember.update({ where: { challengeId_userId: { challengeId: id, userId: user.id } }, data: { completedAt: new Date() } });
        completed = true;
        if (c.official) await award(user.id, `CH_${c.id}`, c.badgeName ?? c.title);
      }
    }
    after(() => syncBadges(user.id));
    revalidatePath(`/community/challenges/${id}`);
    revalidatePath("/community", "layout");
    return { completed };
  });
}

export async function archiveChallenge(id: string) {
  return run(async () => {
    const user = await requireUser();
    const c = await db.challenge.findUnique({ where: { id } });
    if (!c) throw new UserError("NOT_FOUND");
    if (c.creatorId !== user.id && user.role !== "ADMIN") throw new UserError("FORBIDDEN");
    await db.challenge.update({ where: { id }, data: { archivedAt: new Date() } });
    revalidatePath("/community/challenges");
    revalidatePath("/admin/challenges");
  });
}
