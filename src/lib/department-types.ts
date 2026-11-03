export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type DepartmentRole = "MANAGER" | "MEMBER" | "VIEWER";

export const DEPARTMENT_MODULES = ["overview", "goals", "projects", "tasks", "calendar", "members", "reports", "files", "discussions"] as const;
export type DepartmentModule = (typeof DEPARTMENT_MODULES)[number];
