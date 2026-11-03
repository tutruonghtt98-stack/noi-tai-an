import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { resolveActiveWorkspace, getWorkspaceOverview } from "@/lib/department-queries";
import { SplitHeading } from "@/components/ui/split-heading";
import { CountUp } from "@/components/ui/count-up";
import { Avatar } from "@/components/ui/avatar";
import { Empty } from "@/components/ui/empty";
import { DepartmentsNav } from "./nav";
import { DEPT_DOT } from "./colors";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { AddDepartmentButton } from "./list/add-department-form";

export const metadata: Metadata = { title: "Phòng ban" };

export default async function DepartmentsOverviewPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.departments;
  const sp = await searchParams;

  const { active, list } = await resolveActiveWorkspace(user.id, user.name, sp.w);
  const overview = await getWorkspaceOverview(active.id);
  const isOwner = active.ownerId === user.id;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <SplitHeading text={w.title} className="text-2xl font-semibold sm:text-[2rem]" />
          <p className="mt-2 text-ink-2">{w.subtitle}</p>
        </div>
      </div>

      <div className="mb-6">
        <WorkspaceSwitcher workspaces={list.map((ws) => ({ id: ws.id, name: ws.name }))} active={active.id} isOwner={isOwner} />
      </div>

      <DepartmentsNav active="overview" workspaceId={active.id} t={w} />

      <section className="card grid grid-cols-1 gap-3 p-3 sm:grid-cols-3 sm:p-4">
        <div className="rounded-[1.5rem] bg-ink p-5 text-bg">
          <p className="text-sm font-medium opacity-70">{w.statDepartments}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={overview.departments} />
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{w.statMembers}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={overview.members} />
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{w.statTeams}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={overview.teams} />
          </p>
        </div>
      </section>

      <section className="card mt-[var(--gap)]" aria-labelledby="recent-departments">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="recent-departments" className="card-title">
            {w.recentDepartments}
          </h2>
          <AddDepartmentButton workspaceId={active.id} />
        </div>
        {overview.recentDepartments.length === 0 ? (
          <Empty icon={Building2} text={w.recentDepartmentsEmpty} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {overview.recentDepartments.map((d) => (
              <Link key={d.id} href={`/departments/${d.id}?w=${active.id}`} className="block rounded-[1.25rem] border border-line p-4 hover:bg-surface-2">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${DEPT_DOT[d.color] ?? "bg-muted"}`} aria-hidden />
                  <p className="truncate font-medium">{d.name}</p>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-muted">
                  <span className="tabular">{d._count.members} {w.colMembers.toLowerCase()}</span>
                  <span className="tabular">{d._count.teams} {w.colTeams.toLowerCase()}</span>
                </div>
                {d.manager && (
                  <div className="mt-3 flex items-center gap-2">
                    <Avatar name={d.manager.name ?? "?"} image={d.manager.image} size={24} />
                    <span className="truncate text-xs text-muted">{d.manager.name}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
