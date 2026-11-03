import Link from "next/link";
import type { Dict } from "@/lib/i18n/vi";

type Tab = "overview" | "departments" | "teams" | "members" | "reports";

const ROUTES: Record<Tab, string> = {
  overview: "/departments",
  departments: "/departments/list",
  teams: "/departments/teams",
  members: "/departments/members",
  reports: "/departments/reports",
};

export function DepartmentsNav({ active, workspaceId, t }: { active: Tab; workspaceId: string; t: Dict["departments"] }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t.tabOverview },
    { key: "departments", label: t.tabDepartments },
    { key: "teams", label: t.tabTeams },
    { key: "members", label: t.tabMembers },
    { key: "reports", label: t.tabReports },
  ];
  return (
    <nav className="segmented mb-6 max-w-full overflow-x-auto" aria-label={t.title}>
      {tabs.map((tab) => (
        <Link key={tab.key} href={`${ROUTES[tab.key]}?w=${workspaceId}`} aria-current={active === tab.key ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
