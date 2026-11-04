"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { DEFAULT_LISTS, getCardComments } from "@/lib/work-queries";
import { getUserTeamIds } from "@/lib/department-queries";
import type { Prisma } from "@/generated/prisma/client";

const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  city: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null),
  channel: z.enum(["ONLINE", "IN_STORE"]),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
export type CustomerInput = z.input<typeof customerSchema>;

export async function createWorkCustomer(input: CustomerInput) {
  return run(async () => {
    const user = await requireUser();
    const data = customerSchema.parse(input);
    await db.workCustomer.create({ data: { ...data, userId: user.id } });
    revalidatePath("/customers");
  });
}

export async function deleteWorkCustomer(id: string) {
  return run(async () => {
    const user = await requireUser();
    const row = await db.workCustomer.findUnique({ where: { id }, select: { userId: true } });
    if (!row || row.userId !== user.id) throw new UserError("VALIDATION");
    await db.workCustomer.delete({ where: { id } });
    revalidatePath("/customers");
  });
}

// ---------- Workspace (Kanban) ----------

const boardSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  assignee: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(160)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  teamId: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
});
export type BoardInput = z.input<typeof boardSchema>;

/** Team phải thuộc workspace mà user sở hữu/tham gia — tránh gắn team của người khác vào bảng/thẻ của mình. */
async function resolveTeam(userId: string, teamId: string | null) {
  if (!teamId) return null;
  const team = await db.team.findFirst({ where: { id: teamId, department: { workspace: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] } } }, select: { id: true } });
  if (!team) throw new UserError("VALIDATION");
  return teamId;
}

async function notifyTeamShared(teamId: string, actor: { id: string; name: string | null; email: string | null }, title: string, body: string) {
  const members = await db.teamMember.findMany({ where: { teamId, userId: { not: actor.id } }, select: { userId: true } });
  for (const m of members) {
    await db.notification.create({ data: { userId: m.userId, actorId: actor.id, type: "WORK_BOARD_SHARED", title, body, href: "/workspace" } });
  }
}

export async function createWorkBoard(input: BoardInput) {
  return run(async () => {
    const user = await requireUser();
    const { teamId: rawTeamId, ...data } = boardSchema.parse(input);
    const teamId = await resolveTeam(user.id, rawTeamId);
    const assigneeUserId = await resolveAssigneeId(data.assignee);
    const count = await db.workBoard.count({ where: { userId: user.id } });
    const board = await db.workBoard.create({
      data: {
        ...data,
        assigneeUserId,
        teamId,
        userId: user.id,
        sortOrder: count,
        lists: {
          create: DEFAULT_LISTS.map((l, i) => ({ name: l.name, color: l.color, sortOrder: i })),
        },
      },
    });
    if (assigneeUserId && assigneeUserId !== user.id) {
      await db.notification.create({
        data: {
          userId: assigneeUserId,
          actorId: user.id,
          type: "WORK_BOARD_SHARED",
          title: `${user.name ?? user.email ?? "Ai đó"} đã gắn bạn làm người phụ trách một bảng công việc`,
          body: data.name,
          href: "/workspace",
        },
      });
    }
    if (teamId) {
      await notifyTeamShared(teamId, user, `${user.name ?? user.email ?? "Ai đó"} đã chia sẻ bảng công việc với team của bạn`, data.name);
    }
    revalidatePath("/workspace");
    return board.id;
  });
}

export async function updateWorkBoard(id: string, input: BoardInput) {
  return run(async () => {
    const user = await requireUser();
    const row = await db.workBoard.findUnique({ where: { id }, select: { userId: true, assigneeUserId: true, teamId: true } });
    if (!row || row.userId !== user.id) throw new UserError("VALIDATION");
    const { teamId: rawTeamId, ...data } = boardSchema.parse(input);
    const teamId = await resolveTeam(user.id, rawTeamId);
    const assigneeUserId = await resolveAssigneeId(data.assignee);
    await db.workBoard.update({ where: { id }, data: { ...data, assigneeUserId, teamId } });
    if (assigneeUserId && assigneeUserId !== user.id && assigneeUserId !== row.assigneeUserId) {
      await db.notification.create({
        data: {
          userId: assigneeUserId,
          actorId: user.id,
          type: "WORK_BOARD_SHARED",
          title: `${user.name ?? user.email ?? "Ai đó"} đã gắn bạn làm người phụ trách một bảng công việc`,
          body: data.name,
          href: "/workspace",
        },
      });
    }
    if (teamId && teamId !== row.teamId) {
      await notifyTeamShared(teamId, user, `${user.name ?? user.email ?? "Ai đó"} đã chia sẻ bảng công việc với team của bạn`, data.name);
    }
    revalidatePath("/workspace");
  });
}

export async function deleteWorkBoard(id: string) {
  return run(async () => {
    const user = await requireUser();
    const row = await db.workBoard.findUnique({ where: { id }, select: { userId: true } });
    if (!row || row.userId !== user.id) throw new UserError("VALIDATION");
    await db.workBoard.delete({ where: { id } });
    revalidatePath("/workspace");
  });
}

const cardSchema = z.object({
  listId: z.string().min(1),
  label: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => v || null),
  title: z.string().trim().min(1).max(160),
  assignee: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(160)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  teamId: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
});
export type CardInput = z.input<typeof cardSchema>;

async function notifyAssignee(assigneeEmail: string | null, actor: { id: string; name: string | null; email: string | null }, cardTitle: string) {
  if (!assigneeEmail) return;
  const target = await db.user.findUnique({ where: { email: assigneeEmail }, select: { id: true } });
  if (!target || target.id === actor.id) return target?.id ?? null;
  await db.notification.create({
    data: {
      userId: target.id,
      actorId: actor.id,
      type: "WORK_CARD_ASSIGNED",
      title: `${actor.name ?? actor.email ?? "Ai đó"} đã gắn bạn vào một việc`,
      body: cardTitle,
      href: "/workspace",
    },
  });
  return target.id;
}

async function resolveAssigneeId(email: string | null) {
  if (!email) return null;
  const target = await db.user.findUnique({ where: { email }, select: { id: true } });
  return target?.id ?? null;
}

/** Cột "Hoàn thành" (listDone) quyết định mốc completedAt cho báo cáo trước/đúng/trễ hạn. */
const isDoneList = (name: string) => name === "listDone";

/** Chỉ chủ bảng mới được tạo/xoá thẻ và cấp quyền (gắn người phụ trách hoặc team phụ trách) cho thẻ. */
function isBoardOwner(board: { userId: string }, userId: string) {
  return board.userId === userId;
}

/** Chủ bảng toàn quyền; người/team được cấp quyền trực tiếp trên thẻ (card.assigneeUserId / card.teamId)
 * chỉ xem/thao tác được đúng thẻ đó, không có quyền trên các thẻ khác của bảng. */
function canActOnCard(
  card: { assigneeUserId: string | null; teamId: string | null; list: { board: { userId: string } } },
  userId: string,
  userTeamIds: string[],
) {
  return isBoardOwner(card.list.board, userId) || card.assigneeUserId === userId || (!!card.teamId && userTeamIds.includes(card.teamId));
}

export async function createWorkCard(input: CardInput) {
  return run(async () => {
    const user = await requireUser();
    const { teamId: rawTeamId, ...data } = cardSchema.parse(input);
    const list = await db.workList.findUnique({ where: { id: data.listId }, select: { name: true, board: { select: { userId: true } } } });
    if (!list || !isBoardOwner(list.board, user.id)) throw new UserError("VALIDATION");
    const teamId = await resolveTeam(user.id, rawTeamId);
    const count = await db.workCard.count({ where: { listId: data.listId } });
    const assigneeUserId = await resolveAssigneeId(data.assignee);
    await db.workCard.create({
      data: { ...data, teamId, assigneeUserId, sortOrder: count, checklist: [], completedAt: isDoneList(list.name) ? new Date() : null },
    });
    await notifyAssignee(data.assignee, user, data.title);
    if (teamId) await notifyTeamShared(teamId, user, `${user.name ?? user.email ?? "Ai đó"} đã cấp quyền thẻ cho team của bạn`, data.title);
    revalidatePath("/workspace");
  });
}

const cardUpdateSchema = cardSchema;
export type CardUpdateInput = z.input<typeof cardUpdateSchema>;

export async function updateWorkCard(id: string, input: CardUpdateInput) {
  return run(async () => {
    const user = await requireUser();
    const { teamId: rawTeamId, ...data } = cardUpdateSchema.parse(input);
    const card = await db.workCard.findUnique({
      where: { id },
      select: {
        listId: true,
        assignee: true,
        assigneeUserId: true,
        teamId: true,
        completedAt: true,
        list: { select: { boardId: true, name: true, board: { select: { userId: true } } } },
      },
    });
    if (!card) throw new UserError("VALIDATION");
    const userTeamIds = await getUserTeamIds(user.id);
    if (!canActOnCard(card, user.id, userTeamIds)) throw new UserError("VALIDATION");
    const isOwner = isBoardOwner(card.list.board, user.id);
    // Thẻ đã được duyệt (ở cột Hoàn thành) — chỉ chủ bảng mới được sửa, người được cấp quyền chỉ xem.
    if (isDoneList(card.list.name) && !isOwner) throw new UserError("VALIDATION");
    const targetList = await db.workList.findUnique({ where: { id: data.listId }, select: { name: true, boardId: true } });
    if (!targetList || targetList.boardId !== card.list.boardId) throw new UserError("VALIDATION");
    const changingList = data.listId !== card.listId;
    const sortOrder = changingList ? await db.workCard.count({ where: { listId: data.listId } }) : undefined;
    // Chỉ chủ bảng mới được đổi người/team phụ trách của thẻ — người được cấp quyền chỉ cập nhật nội dung/tiến độ.
    const assignee = isOwner ? data.assignee : card.assignee;
    const assigneeChanged = isOwner && data.assignee !== card.assignee;
    const assigneeUserId = isOwner ? await resolveAssigneeId(data.assignee) : card.assigneeUserId;
    const teamId = isOwner ? await resolveTeam(user.id, rawTeamId) : card.teamId;
    const teamChanged = isOwner && teamId !== card.teamId;
    const completedAt = changingList ? (isDoneList(targetList.name) ? (card.completedAt ?? new Date()) : null) : undefined;
    await db.workCard.update({
      where: { id },
      data: { ...data, assignee, assigneeUserId, teamId, ...(sortOrder != null ? { sortOrder } : {}), ...(completedAt !== undefined ? { completedAt } : {}) },
    });
    if (assigneeChanged) await notifyAssignee(data.assignee, user, data.title);
    if (teamChanged && teamId) await notifyTeamShared(teamId, user, `${user.name ?? user.email ?? "Ai đó"} đã cấp quyền thẻ cho team của bạn`, data.title);
    revalidatePath("/workspace");
    revalidatePath("/analytics");
  });
}

const checklistItemSchema = z.object({ id: z.string().min(1), text: z.string().trim().min(1).max(200), done: z.boolean() });

export async function updateWorkCardChecklist(id: string, checklist: { id: string; text: string; done: boolean }[]) {
  return run(async () => {
    const user = await requireUser();
    const card = await db.workCard.findUnique({
      where: { id },
      select: { assigneeUserId: true, teamId: true, list: { select: { name: true, board: { select: { userId: true } } } } },
    });
    if (!card) throw new UserError("VALIDATION");
    const userTeamIds = await getUserTeamIds(user.id);
    if (!canActOnCard(card, user.id, userTeamIds)) throw new UserError("VALIDATION");
    if (isDoneList(card.list.name) && !isBoardOwner(card.list.board, user.id)) throw new UserError("VALIDATION");
    const parsed = z.array(checklistItemSchema).max(50).parse(checklist);
    await db.workCard.update({ where: { id }, data: { checklist: parsed as Prisma.InputJsonValue } });
    revalidatePath("/workspace");
  });
}

export async function moveWorkCard(id: string, toListId: string) {
  return run(async () => {
    const user = await requireUser();
    const card = await db.workCard.findUnique({
      where: { id },
      select: { assigneeUserId: true, teamId: true, completedAt: true, list: { select: { name: true, boardId: true, board: { select: { userId: true } } } } },
    });
    if (!card) throw new UserError("VALIDATION");
    const userTeamIds = await getUserTeamIds(user.id);
    if (!canActOnCard(card, user.id, userTeamIds)) throw new UserError("VALIDATION");
    const isOwner = isBoardOwner(card.list.board, user.id);
    // Thẻ đã duyệt chỉ chủ bảng mới được di chuyển tiếp; và chỉ chủ bảng mới được duyệt (chuyển vào Hoàn thành).
    if (isDoneList(card.list.name) && !isOwner) throw new UserError("VALIDATION");
    const toList = await db.workList.findUnique({ where: { id: toListId }, select: { name: true, boardId: true } });
    if (!toList || toList.boardId !== card.list.boardId) throw new UserError("VALIDATION");
    if (isDoneList(toList.name) && !isOwner) throw new UserError("VALIDATION");
    const count = await db.workCard.count({ where: { listId: toListId } });
    const completedAt = isDoneList(toList.name) ? (card.completedAt ?? new Date()) : null;
    await db.workCard.update({ where: { id }, data: { listId: toListId, sortOrder: count, completedAt } });
    revalidatePath("/workspace");
    revalidatePath("/analytics");
  });
}

export async function deleteWorkCard(id: string) {
  return run(async () => {
    const user = await requireUser();
    const card = await db.workCard.findUnique({ where: { id }, select: { list: { select: { board: { select: { userId: true } } } } } });
    if (!card || !isBoardOwner(card.list.board, user.id)) throw new UserError("VALIDATION");
    await db.workCard.delete({ where: { id } });
    revalidatePath("/workspace");
  });
}

// ---------- Bình luận thẻ ----------

export async function listWorkCardComments(cardId: string) {
  return run(async () => {
    const user = await requireUser();
    const card = await db.workCard.findUnique({
      where: { id: cardId },
      select: { assigneeUserId: true, teamId: true, list: { select: { board: { select: { userId: true } } } } },
    });
    if (!card) throw new UserError("VALIDATION");
    const userTeamIds = await getUserTeamIds(user.id);
    if (!canActOnCard(card, user.id, userTeamIds)) throw new UserError("VALIDATION");
    const comments = await getCardComments(cardId);
    return comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      userName: c.user.name,
      userImage: c.user.image,
    }));
  });
}

export async function addWorkCardComment(cardId: string, content: string) {
  return run(async () => {
    const user = await requireUser();
    const card = await db.workCard.findUnique({
      where: { id: cardId },
      select: { title: true, assigneeUserId: true, teamId: true, list: { select: { board: { select: { id: true, userId: true } } } } },
    });
    if (!card) throw new UserError("VALIDATION");
    const userTeamIds = await getUserTeamIds(user.id);
    if (!canActOnCard(card, user.id, userTeamIds)) throw new UserError("VALIDATION");
    const text = z.string().trim().min(1).max(1000).parse(content);
    await db.workCardComment.create({ data: { cardId, userId: user.id, content: text } });

    const notifyIds = new Set<string>();
    const board = card.list.board;
    if (board.userId !== user.id) notifyIds.add(board.userId);
    if (card.assigneeUserId && card.assigneeUserId !== user.id) notifyIds.add(card.assigneeUserId);
    if (card.teamId) {
      const members = await db.teamMember.findMany({ where: { teamId: card.teamId, userId: { not: user.id } }, select: { userId: true } });
      for (const m of members) notifyIds.add(m.userId);
    }
    const href = `/workspace?b=${board.id}&card=${cardId}`;
    for (const id of notifyIds) {
      await db.notification.create({
        data: {
          userId: id,
          actorId: user.id,
          type: "WORK_CARD_COMMENT",
          title: `${user.name ?? user.email ?? "Ai đó"} đã bình luận`,
          body: `${card.title}: ${text}`,
          href,
        },
      });
    }
    revalidatePath("/workspace");
  });
}
