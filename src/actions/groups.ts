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
import { limitsFor } from "@/lib/plan";
import { searchGroups } from "@/lib/group-discovery";

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
  maxMembers: z.number().int().min(3).max(25),
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

// ---------- Nhóm công khai: thiết lập, xin tham gia, duyệt ----------

const settingsSchema = z.object({
  isPublic: z.boolean(),
  category: z.enum(["READING", "WORKOUT", "STUDY", "FOCUS", "GOAL", "OTHER"]).nullable(),
  city: z.string().trim().max(80).optional().transform((v) => v || null),
  description: z.string().trim().max(500).optional().transform((v) => v || null),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});

export async function updateGroupSettings(groupId: string, input: z.input<typeof settingsSchema>) {
  return run(async () => {
    const user = await requireUser();
    await assertOwner(user.id, groupId);
    const d = settingsSchema.parse(input);
    // Làm tròn ~1 km để không lộ địa chỉ chính xác
    const round = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);
    await db.group.update({ where: { id: groupId }, data: { ...d, lat: round(d.lat), lng: round(d.lng) } });
    revalidatePath("/community", "layout");
  });
}

export async function requestJoin(groupId: string, message: string) {
  return run(async () => {
    const user = await requireUser();
    if (!limitsFor(user).joinPublicGroups) throw new UserError("PRO_ONLY_GROUP");
    rateLimit(`joinreq:${user.id}`, 10, 86_400_000);
    const msg = z.string().trim().max(300).parse(message) || null;
    const g = await db.group.findUnique({ where: { id: groupId }, include: { _count: { select: { members: true } } } });
    if (!g || !g.isPublic) throw new UserError("NOT_FOUND");
    if (g._count.members >= g.maxMembers) throw new UserError("GROUP_FULL");
    if (await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } })) throw new UserError("ALREADY_MEMBER");
    await assertGroupQuota(user.id);
    const pending = await db.groupJoinRequest.findFirst({ where: { groupId, userId: user.id, status: "PENDING" } });
    if (pending) await db.groupJoinRequest.update({ where: { id: pending.id }, data: { message: msg } });
    else await db.groupJoinRequest.create({ data: { groupId, userId: user.id, message: msg } });
    revalidatePath("/community/groups");
  });
}

export async function cancelJoinRequest(groupId: string) {
  return run(async () => {
    const user = await requireUser();
    await db.groupJoinRequest.deleteMany({ where: { groupId, userId: user.id, status: "PENDING" } });
    revalidatePath("/community/groups");
  });
}

export async function reviewJoinRequest(requestId: string, approve: boolean) {
  return run(async () => {
    const user = await requireUser();
    const r = await db.groupJoinRequest.findUnique({ where: { id: requestId }, include: { group: { include: { _count: { select: { members: true } } } } } });
    if (!r || r.status !== "PENDING") throw new UserError("NOT_FOUND");
    await assertOwner(user.id, r.groupId);
    if (approve) {
      if (r.group._count.members >= r.group.maxMembers) throw new UserError("GROUP_FULL");
      if ((await db.groupMember.count({ where: { userId: r.userId } })) >= MAX_GROUPS_PER_USER) throw new UserError("GROUP_LIMIT");
      await db.$transaction([
        db.groupMember.upsert({
          where: { groupId_userId: { groupId: r.groupId, userId: r.userId } },
          update: {},
          create: { groupId: r.groupId, userId: r.userId },
        }),
        db.groupJoinRequest.update({ where: { id: r.id }, data: { status: "APPROVED", reviewedBy: user.id, reviewedAt: new Date() } }),
      ]);
    } else {
      await db.groupJoinRequest.update({ where: { id: r.id }, data: { status: "REJECTED", reviewedBy: user.id, reviewedAt: new Date() } });
    }
    revalidatePath(`/community/groups/${r.groupId}`);
    revalidatePath("/community/groups");
  });
}

/** Tìm nhóm công khai. Toạ độ chỉ dùng để tính khoảng cách, không ghi vào DB. */
export async function findGroups(input: { q?: string; lat?: number | null; lng?: number | null; radiusKm?: number }) {
  return run(async () => {
    const user = await requireUser();
    rateLimit(`findgroups:${user.id}`, 60, 3600_000);
    const d = z
      .object({
        q: z.string().max(80).optional(),
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
        radiusKm: z.number().min(1).max(200).default(10),
      })
      .parse(input);
    return searchGroups(user.id, d);
  });
}
