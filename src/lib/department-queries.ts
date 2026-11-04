import "server-only";
import { db } from "@/lib/db";
import type { WorkspaceRole } from "@/lib/department-types";

export type { WorkspaceRole, DepartmentRole, DepartmentModule } from "@/lib/department-types";
export { DEPARTMENT_MODULES } from "@/lib/department-types";

/** Workspace đầu tiên người dùng sở hữu/tham gia; tự tạo một workspace mặc định nếu chưa có. */
export async function getOrCreateDefaultWorkspace(userId: string, userName: string | null) {
  const existing = await db.workspace.findFirst({
    where: { archivedAt: null, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return db.workspace.create({
    data: {
      ownerId: userId,
      name: userName ? `Workspace của ${userName}` : "Workspace của tôi",
      members: { create: { userId, role: "OWNER" } },
    },
  });
}

export async function getWorkspaces(userId: string) {
  return db.workspace.findMany({
    where: { archivedAt: null, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { departments: true, members: true } } },
  });
}

/** Workspace đang xem: ưu tiên `requestedId` nếu người dùng có quyền, nếu không trả về workspace mặc định. */
export async function resolveActiveWorkspace(userId: string, userName: string | null, requestedId?: string) {
  const list = await getWorkspaces(userId);
  const requested = requestedId ? list.find((w) => w.id === requestedId) : null;
  if (requested) return { active: requested, list };
  if (list[0]) return { active: list[0], list };
  const created = await getOrCreateDefaultWorkspace(userId, userName);
  return { active: { ...created, _count: { departments: 0, members: 1 } }, list: [{ ...created, _count: { departments: 0, members: 1 } }] };
}

/** Xác nhận user có quyền truy cập workspace (owner hoặc member), trả về vai trò nếu có. */
export async function getWorkspaceAccess(workspaceId: string, userId: string) {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
  });
  if (!ws) return null;
  if (ws.ownerId === userId) return { role: "OWNER" as WorkspaceRole, isOwner: true };
  if (ws.members[0]) return { role: ws.members[0].role as WorkspaceRole, isOwner: false };
  return null;
}

export async function getWorkspaceOverview(workspaceId: string) {
  const [departments, members, teams] = await Promise.all([
    db.department.count({ where: { workspaceId, archivedAt: null } }),
    db.workspaceMember.count({ where: { workspaceId } }),
    db.team.count({ where: { archivedAt: null, department: { workspaceId } } }),
  ]);
  const recentDepartments = await db.department.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { manager: { select: { name: true, image: true } }, _count: { select: { members: true, teams: true } } },
  });
  return { departments, members, teams, recentDepartments };
}

export async function getWorkspaceMembers(workspaceId: string) {
  const [owner, members] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { owner: { select: { id: true, name: true, email: true, image: true } } } }),
    db.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    }),
  ]);
  return { owner: owner?.owner ?? null, members };
}

export async function getDepartments(workspaceId: string) {
  return db.department.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    include: { manager: { select: { id: true, name: true, image: true } }, _count: { select: { members: true, teams: true } } },
  });
}

export async function getDepartmentDetail(departmentId: string) {
  return db.department.findUnique({
    where: { id: departmentId },
    include: {
      manager: { select: { id: true, name: true, image: true } },
      workspace: { select: { id: true, name: true, ownerId: true } },
      members: { orderBy: { joinedAt: "asc" }, include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      teams: {
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        include: { leader: { select: { id: true, name: true, image: true } }, _count: { select: { members: true } } },
      },
    },
  });
}
export type DepartmentDetail = NonNullable<Awaited<ReturnType<typeof getDepartmentDetail>>>;

export async function getTeams(workspaceId: string) {
  return db.team.findMany({
    where: { archivedAt: null, department: { workspaceId } },
    orderBy: { createdAt: "asc" },
    include: {
      department: { select: { id: true, name: true, color: true } },
      leader: { select: { id: true, name: true, image: true } },
      _count: { select: { members: true } },
    },
  });
}

export async function getTeamDetail(teamId: string) {
  return db.team.findUnique({
    where: { id: teamId },
    include: {
      department: { select: { id: true, name: true, workspaceId: true } },
      leader: { select: { id: true, name: true, image: true } },
      members: { orderBy: { joinedAt: "asc" }, include: { user: { select: { id: true, name: true, email: true, image: true } } } },
    },
  });
}

/** Team để chọn làm "team phụ trách" một bảng Workspace — mọi team trong các workspace mà user sở hữu/tham gia. */
export async function getUserTeams(userId: string) {
  return db.team.findMany({
    where: {
      archivedAt: null,
      department: { workspace: { archivedAt: null, OR: [{ ownerId: userId }, { members: { some: { userId } } }] } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, department: { select: { name: true } } },
  });
}

/** Danh sách teamId mà user là thành viên — dùng để xác định quyền xem/thao tác thẻ được cấp cho team. */
export async function getUserTeamIds(userId: string) {
  const rows = await db.teamMember.findMany({ where: { userId }, select: { teamId: true } });
  return rows.map((r) => r.teamId);
}

/** Mọi người trong các workspace mà user sở hữu/tham gia — gợi ý nhanh khi gán "người phụ trách" cho bảng/thẻ. */
export async function getUserWorkspaceMembers(userId: string) {
  const workspaces = await db.workspace.findMany({
    where: { archivedAt: null, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: {
      owner: { select: { id: true, name: true, email: true } },
      members: { select: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  const map = new Map<string, { id: string; name: string | null; email: string | null }>();
  for (const w of workspaces) {
    map.set(w.owner.id, w.owner);
    for (const m of w.members) map.set(m.user.id, m.user);
  }
  return [...map.values()].filter((u) => u.id !== userId && u.email);
}
