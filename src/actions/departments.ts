"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { DEPARTMENT_MODULES } from "@/lib/department-queries";

async function requireWorkspaceAdmin(workspaceId: string, userId: string) {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
  });
  if (!ws) throw new UserError("NOT_FOUND");
  const isAdmin = ws.ownerId === userId || ws.members[0]?.role === "ADMIN" || ws.members[0]?.role === "OWNER";
  if (!isAdmin) throw new UserError("FORBIDDEN");
}

async function requireDepartmentManage(departmentId: string, userId: string) {
  const dept = await db.department.findUnique({
    where: { id: departmentId },
    select: { workspaceId: true, managerId: true, workspace: { select: { ownerId: true } } },
  });
  if (!dept) throw new UserError("NOT_FOUND");
  if (dept.workspace.ownerId === userId || dept.managerId === userId) return dept;
  const wsMember = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: dept.workspaceId, userId } } });
  if (wsMember?.role === "ADMIN" || wsMember?.role === "OWNER") return dept;
  throw new UserError("FORBIDDEN");
}

async function notifyMember(targetUserId: string, actor: { id: string; name: string | null; email: string | null }, title: string, body: string, href: string) {
  if (targetUserId === actor.id) return;
  await db.notification.create({ data: { userId: targetUserId, actorId: actor.id, type: "DEPARTMENT_INVITE", title, body, href } });
}

// ---------- Workspace ----------

const workspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
});
export type WorkspaceInput = z.input<typeof workspaceSchema>;

export async function createWorkspace(input: WorkspaceInput) {
  return run(async () => {
    const user = await requireUser();
    const data = workspaceSchema.parse(input);
    const ws = await db.workspace.create({ data: { ...data, ownerId: user.id, members: { create: { userId: user.id, role: "OWNER" } } } });
    revalidatePath("/departments");
    return ws.id;
  });
}

export async function updateWorkspace(id: string, input: WorkspaceInput) {
  return run(async () => {
    const user = await requireUser();
    await requireWorkspaceAdmin(id, user.id);
    const data = workspaceSchema.parse(input);
    await db.workspace.update({ where: { id }, data });
    revalidatePath("/departments");
  });
}

export async function archiveWorkspace(id: string) {
  return run(async () => {
    const user = await requireUser();
    const ws = await db.workspace.findUnique({ where: { id }, select: { ownerId: true } });
    if (!ws || ws.ownerId !== user.id) throw new UserError("FORBIDDEN");
    await db.workspace.update({ where: { id }, data: { archivedAt: new Date() } });
    revalidatePath("/departments");
  });
}

export async function inviteWorkspaceMember(workspaceId: string, email: string, role: "ADMIN" | "MEMBER") {
  return run(async () => {
    const user = await requireUser();
    await requireWorkspaceAdmin(workspaceId, user.id);
    const target = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (!target) throw new UserError("USER_NOT_FOUND");
    const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    await db.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: target.id } },
      update: { role },
      create: { workspaceId, userId: target.id, role },
    });
    await notifyMember(target.id, user, `${user.name ?? user.email ?? "Ai đó"} đã thêm bạn vào workspace`, ws?.name ?? "", "/departments");
    revalidatePath("/departments");
  });
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  return run(async () => {
    const user = await requireUser();
    await requireWorkspaceAdmin(workspaceId, user.id);
    await db.workspaceMember.deleteMany({ where: { workspaceId, userId } });
    revalidatePath("/departments");
  });
}

// ---------- Department ----------

const departmentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v || null),
  description: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
  color: z.enum(["ochre", "jade", "mist", "rose"]).default("ochre"),
  managerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
});
export type DepartmentInput = z.input<typeof departmentSchema>;

export async function createDepartment(workspaceId: string, input: DepartmentInput) {
  return run(async () => {
    const user = await requireUser();
    await requireWorkspaceAdmin(workspaceId, user.id);
    const { managerEmail, ...data } = departmentSchema.parse(input);
    const manager = managerEmail ? await db.user.findUnique({ where: { email: managerEmail }, select: { id: true } }) : null;
    const dept = await db.department.create({ data: { ...data, workspaceId, managerId: manager?.id ?? null } });
    if (manager) {
      await db.departmentMember.upsert({
        where: { departmentId_userId: { departmentId: dept.id, userId: manager.id } },
        update: { role: "MANAGER" },
        create: { departmentId: dept.id, userId: manager.id, role: "MANAGER" },
      });
    }
    revalidatePath("/departments");
    return dept.id;
  });
}

export async function updateDepartment(id: string, input: DepartmentInput) {
  return run(async () => {
    const user = await requireUser();
    await requireDepartmentManage(id, user.id);
    const { managerEmail, ...data } = departmentSchema.parse(input);
    const manager = managerEmail ? await db.user.findUnique({ where: { email: managerEmail }, select: { id: true } }) : null;
    await db.department.update({ where: { id }, data: { ...data, managerId: manager?.id ?? null } });
    if (manager) {
      await db.departmentMember.upsert({
        where: { departmentId_userId: { departmentId: id, userId: manager.id } },
        update: { role: "MANAGER" },
        create: { departmentId: id, userId: manager.id, role: "MANAGER" },
      });
    }
    revalidatePath("/departments");
  });
}

export async function archiveDepartment(id: string) {
  return run(async () => {
    const user = await requireUser();
    await requireDepartmentManage(id, user.id);
    await db.department.update({ where: { id }, data: { archivedAt: new Date() } });
    revalidatePath("/departments");
  });
}

export async function deleteDepartment(id: string) {
  return run(async () => {
    const user = await requireUser();
    const dept = await db.department.findUnique({ where: { id }, select: { workspace: { select: { ownerId: true } } } });
    if (!dept || dept.workspace.ownerId !== user.id) throw new UserError("FORBIDDEN");
    await db.department.delete({ where: { id } });
    revalidatePath("/departments");
  });
}

export async function updateDepartmentModules(id: string, modules: string[]) {
  return run(async () => {
    const user = await requireUser();
    await requireDepartmentManage(id, user.id);
    const parsed = z
      .array(z.enum(DEPARTMENT_MODULES as unknown as [string, ...string[]]))
      .max(20)
      .parse(modules);
    await db.department.update({ where: { id }, data: { modules: parsed } });
    revalidatePath("/departments");
  });
}

export async function addDepartmentMember(departmentId: string, email: string, role: "MANAGER" | "MEMBER" | "VIEWER") {
  return run(async () => {
    const user = await requireUser();
    const dept = await requireDepartmentManage(departmentId, user.id);
    const target = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (!target) throw new UserError("USER_NOT_FOUND");
    // Đảm bảo thành viên phòng ban cũng thuộc workspace
    await db.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: dept.workspaceId, userId: target.id } },
      update: {},
      create: { workspaceId: dept.workspaceId, userId: target.id, role: "MEMBER" },
    });
    const deptRow = await db.department.findUnique({ where: { id: departmentId }, select: { name: true } });
    await db.departmentMember.upsert({
      where: { departmentId_userId: { departmentId, userId: target.id } },
      update: { role },
      create: { departmentId, userId: target.id, role },
    });
    await notifyMember(target.id, user, `${user.name ?? user.email ?? "Ai đó"} đã thêm bạn vào phòng ban`, deptRow?.name ?? "", "/departments");
    revalidatePath("/departments");
  });
}

export async function updateDepartmentMemberRole(departmentId: string, userId: string, role: "MANAGER" | "MEMBER" | "VIEWER") {
  return run(async () => {
    const user = await requireUser();
    await requireDepartmentManage(departmentId, user.id);
    await db.departmentMember.updateMany({ where: { departmentId, userId }, data: { role } });
    if (role === "MANAGER") await db.department.update({ where: { id: departmentId }, data: { managerId: userId } });
    revalidatePath("/departments");
  });
}

export async function removeDepartmentMember(departmentId: string, userId: string) {
  return run(async () => {
    const user = await requireUser();
    await requireDepartmentManage(departmentId, user.id);
    await db.departmentMember.deleteMany({ where: { departmentId, userId } });
    revalidatePath("/departments");
  });
}

// ---------- Team ----------

const teamSchema = z.object({
  name: z.string().trim().min(1).max(100),
  leaderEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
});
export type TeamInput = z.input<typeof teamSchema>;

export async function createTeam(departmentId: string, input: TeamInput) {
  return run(async () => {
    const user = await requireUser();
    await requireDepartmentManage(departmentId, user.id);
    const { leaderEmail, ...data } = teamSchema.parse(input);
    const leader = leaderEmail ? await db.user.findUnique({ where: { email: leaderEmail }, select: { id: true } }) : null;
    const team = await db.team.create({ data: { ...data, departmentId, leaderId: leader?.id ?? null } });
    if (leader) await db.teamMember.upsert({ where: { teamId_userId: { teamId: team.id, userId: leader.id } }, update: {}, create: { teamId: team.id, userId: leader.id } });
    revalidatePath("/departments");
    return team.id;
  });
}

export async function updateTeam(id: string, input: TeamInput) {
  return run(async () => {
    const user = await requireUser();
    const team = await db.team.findUnique({ where: { id }, select: { departmentId: true } });
    if (!team) throw new UserError("NOT_FOUND");
    await requireDepartmentManage(team.departmentId, user.id);
    const { leaderEmail, ...data } = teamSchema.parse(input);
    const leader = leaderEmail ? await db.user.findUnique({ where: { email: leaderEmail }, select: { id: true } }) : null;
    await db.team.update({ where: { id }, data: { ...data, leaderId: leader?.id ?? null } });
    if (leader) await db.teamMember.upsert({ where: { teamId_userId: { teamId: id, userId: leader.id } }, update: {}, create: { teamId: id, userId: leader.id } });
    revalidatePath("/departments");
    revalidatePath(`/departments/teams/${id}`);
  });
}

export async function archiveTeam(id: string) {
  return run(async () => {
    const user = await requireUser();
    const team = await db.team.findUnique({ where: { id }, select: { departmentId: true } });
    if (!team) throw new UserError("NOT_FOUND");
    await requireDepartmentManage(team.departmentId, user.id);
    await db.team.update({ where: { id }, data: { archivedAt: new Date() } });
    revalidatePath("/departments");
  });
}

export async function addTeamMember(teamId: string, email: string) {
  return run(async () => {
    const user = await requireUser();
    const team = await db.team.findUnique({ where: { id: teamId }, select: { departmentId: true, department: { select: { workspaceId: true, name: true } } } });
    if (!team) throw new UserError("NOT_FOUND");
    await requireDepartmentManage(team.departmentId, user.id);
    const target = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (!target) throw new UserError("USER_NOT_FOUND");
    await db.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: team.department.workspaceId, userId: target.id } },
      update: {},
      create: { workspaceId: team.department.workspaceId, userId: target.id, role: "MEMBER" },
    });
    await db.departmentMember.upsert({
      where: { departmentId_userId: { departmentId: team.departmentId, userId: target.id } },
      update: {},
      create: { departmentId: team.departmentId, userId: target.id, role: "MEMBER" },
    });
    await db.teamMember.upsert({ where: { teamId_userId: { teamId, userId: target.id } }, update: {}, create: { teamId, userId: target.id } });
    await notifyMember(target.id, user, `${user.name ?? user.email ?? "Ai đó"} đã thêm bạn vào nhóm`, team.department.name, "/departments");
    revalidatePath("/departments");
    revalidatePath(`/departments/teams/${teamId}`);
  });
}

export async function removeTeamMember(teamId: string, userId: string) {
  return run(async () => {
    const user = await requireUser();
    const team = await db.team.findUnique({ where: { id: teamId }, select: { departmentId: true } });
    if (!team) throw new UserError("NOT_FOUND");
    await requireDepartmentManage(team.departmentId, user.id);
    await db.teamMember.deleteMany({ where: { teamId, userId } });
    revalidatePath("/departments");
    revalidatePath(`/departments/teams/${teamId}`);
  });
}
