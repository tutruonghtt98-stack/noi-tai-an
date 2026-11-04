import type { Metadata } from "next";
import Link from "next/link";
import { Users2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { resolveActiveWorkspace, getTeams } from "@/lib/department-queries";
import { Avatar } from "@/components/ui/avatar";
import { SplitHeading } from "@/components/ui/split-heading";
import { Empty } from "@/components/ui/empty";
import { DepartmentsNav } from "../nav";
import { WorkspaceSwitcher } from "../workspace-switcher";
import { DEPT_DOT } from "../colors";

export const metadata: Metadata = { title: "Nhóm" };

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.departments;
  const sp = await searchParams;

  const { active, list } = await resolveActiveWorkspace(user.id, user.name, sp.w);
  const teams = await getTeams(active.id);
  const isOwner = active.ownerId === user.id;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <SplitHeading text={w.teamsPageTitle} className="text-2xl font-semibold sm:text-[2rem]" />
          <p className="mt-2 text-ink-2">{w.teamsPageSubtitle}</p>
        </div>
      </div>

      <div className="mb-6">
        <WorkspaceSwitcher workspaces={list.map((ws) => ({ id: ws.id, name: ws.name }))} active={active.id} isOwner={isOwner} />
      </div>

      <DepartmentsNav active="teams" workspaceId={active.id} t={w} />

      <section className="card" aria-labelledby="teams-list">
        <h2 id="teams-list" className="card-title mb-5 flex items-center gap-2">
          {w.teamsPageTitle}
          <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium">{teams.length}</span>
        </h2>
        {teams.length === 0 ? (
          <Empty icon={Users2} text={w.noTeamsWorkspace} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="pb-3 pr-4 font-medium">{w.colTeam}</th>
                  <th className="pb-3 pr-4 font-medium">{w.colDepartment}</th>
                  <th className="pb-3 pr-4 font-medium">{w.colLeader}</th>
                  <th className="pb-3 text-right font-medium">{w.colMembers}</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="py-3 pr-4 font-medium">
                      <Link href={`/departments/teams/${team.id}?w=${active.id}`} className="hover:underline">
                        {team.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <Link href={`/departments/${team.department.id}?w=${active.id}`} className="inline-flex items-center gap-2 text-ink-2 hover:underline">
                        <span className={`size-2 shrink-0 rounded-full ${DEPT_DOT[team.department.color] ?? "bg-muted"}`} aria-hidden />
                        {team.department.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      {team.leader ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={team.leader.name ?? "?"} image={team.leader.image} size={24} />
                          <span className="truncate text-ink-2">{team.leader.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted">{w.noManager}</span>
                      )}
                    </td>
                    <td className="tabular py-3 text-right">{team._count.members}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
