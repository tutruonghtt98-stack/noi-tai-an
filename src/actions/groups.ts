"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";
import { startOfWeek, toDbDate, todayISO } from "@/lib/dates";
import { syncBadges } from "@/lib/badges";

const MAX_GROUPS_PER_USER = 5;

function inviteCode() {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => a[b % a.length]).join("");
}

async function assertGroupQuota(userId: string) {
  if ((await db.groupMember.count({ where: { userId } })) >= MAX_GROUPS_PER_USER) throw new UserError("GROUP_LIMIT");
}

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().transform((v) => v || null),
  maxMembers: z.number().int().min(3).max(10),
});

export async function createGroup(input: z.input<typeof schema>) {
  return run(async () => {
    const user = await requireUser();
    rateLimit(`group:${user.id}`, 5, 86_400_000);
    await assertGroupQuota(user.id);
    const d = schema.parse(input);
    const g = await db.group.create({
      data: { ...d, ownerId: user.id, inviteCode: inviteCode(), members: { create: { userId: user.id, role: "OWNER" } } },
    });
    after(() => syncBadges(user.id));
    revalidatePath("/community", "layout");
    return { id: g.id };
  });
}

export async function joinGroup(code: string) {
  return run(async () => {
    const user = await requireUser();
    const g = await db.group.findUnique({ where: { inviteCode: code }, include: { _count: { select: { members: true } } } });
    if (!g) throw new UserError("NOT_FOUND");
    const exists = await db.groupMember.findUnique({ where: { groupId_userId: { groupId: g.id, userId: user.id } } });
    if (exists) return { id: g.id };
    if (g._count.members >= g.maxMembers) throw new UserError("GROUP_FULL");
    await assertGroupQuota(user.id);
    await db.groupMember.create({ data: { groupId: g.id, userId: user.id } });
    revalidatePath("/community", "layout");
    return { id: g.id };
  });
}

/** Rời nhóm. Trưởng nhóm rời → chuyển quyền cho thành viên lâu nhất; nhóm trống → xoá. */
export async function leaveGroup(groupId: string) {
  return run(async () => {
    const user = await requireUser();
    const m = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
    if (!m) throw new UserError("NOT_FOUND");
    await db.$transaction(async (tx) => {
      await tx.groupMember.delete({ where: { groupId_userId: { groupId, userId: user.id } } });
      const next = await tx.groupMember.findFirst({ where: { groupId }, orderBy: { joinedAt: "asc" } });
      if (!next) await tx.group.delete({ where: { id: groupId } });
      else if (m.role === "OWNER") {
        await tx.groupMember.update({ where: { groupId_userId: { groupId, userId: next.userId } }, data: { role: "OWNER" } });
        await tx.group.update({ where: { id: groupId }, data: { ownerId: next.userId } });
      }
    });
    revalidatePath("/community", "layout");
  });
}

async function assertOwner(userId: string, groupId: string) {
  const m = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (m?.role !== "OWNER") throw new UserError("FORBIDDEN");
}

export async function removeMember(groupId: string, memberId: string) {
  return run(async () => {
    const user = await requireUser();
    await assertOwner(user.id, groupId);
    if (memberId === user.id) throw new UserError("SELF");
    await db.groupMember.delete({ where: { groupId_userId: { groupId, userId: memberId } } });
    revalidatePath(`/community/groups/${groupId}`);
  });
}

export async function regenerateInvite(groupId: string) {
  return run(async () => {
    const user = await requireUser();
    await assertOwner(user.id, groupId);
    await db.group.update({ where: { id: groupId }, data: { inviteCode: inviteCode() } });
    revalidatePath(`/community/groups/${groupId}`);
  });
}

export async function setCommitment(groupId: string, text: string) {
  return run(async () => {
    const user = await requireUser();
    const commitment = z.string().trim().max(300).parse(text) || null;
    const week = startOfWeek(todayISO(user.timezone), user.weekStartsOn);
    const res = await db.groupMember.updateMany({ where: { groupId, userId: user.id }, data: { commitment, commitmentWeek: toDbDate(week) } });
    if (!res.count) throw new UserError("FORBIDDEN");
    revalidatePath(`/community/groups/${groupId}`);
  });
}
