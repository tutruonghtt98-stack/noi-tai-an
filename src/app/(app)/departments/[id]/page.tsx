import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { getDepartmentDetail, getWorkspaceAccess } from "@/lib/department-queries";
import { Avatar } from "@/components/ui/avatar";
import { SplitHeading } from "@/components/ui/split-heading";
import { Empty } from "@/components/ui/empty";
import { DEPT_DOT } from "../colors";
import { EditDepartmentButton } from "./edit-department-form";
import { ModulesToggle } from "./modules-toggle";
import { AddMemberButton } from "./add-member-form";
import { MemberRowControls } from "./member-row-controls";
import { AddTeamButton } from "./add-team-form";
import { TeamRowControls } from "./team-row-controls";

export const metadata: Metadata = { title: "Phòng ban" };

export default async function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.departments;
  const { id } = await params;

  const dept = await getDepartmentDetail(id);
  if (!dept) notFound();
  const access = await getWorkspaceAccess(dept.workspace.id, user.id);
  if (!access) notFound();

  return (
    <>
      <Link href={`/departments/list?w=${dept.workspace.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {w.back}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`mt-2 size-3 shrink-0 rounded-full ${DEPT_DOT[dept.color] ?? "bg-muted"}`} aria-hidden />
          <div>
            <SplitHeading text={dept.name} className="text-2xl font-semibold sm:text-[2rem]" />
            {dept.description && <p className="mt-2 text-ink-2">{dept.description}</p>}
          </div>
        </div>
        <EditDepartmentButton
          departmentId={dept.id}
          initial={{ name: dept.name, code: dept.code ?? "", description: dept.description ?? "", color: (dept.color as "ochre") ?? "ochre", managerEmail: "" }}
        />
      </div>

      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-labelledby="members">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="members" className="card-title flex items-center gap-2">
              {w.membersTitle}
              <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium">{dept.members.length}</span>
            </h2>
            <AddMemberButton departmentId={dept.id} />
          </div>
          {dept.members.length === 0 ? (
            <Empty icon={Users2} text={w.emptyMembers} />
          ) : (
            <ul className="space-y-2">
              {dept.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
                  <Avatar name={m.user.name ?? "?"} image={m.user.image} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.user.name ?? m.user.email}</p>
                    <p className="truncate text-xs text-muted">{m.user.email}</p>
                  </div>
                  <MemberRowControls departmentId={dept.id} userId={m.userId} role={m.role} isManagerUser={m.userId === dept.managerId} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="modules">
          <h2 id="modules" className="card-title mb-1">
            {w.modulesTitle}
          </h2>
          <p className="mb-4 text-sm text-muted">{w.modulesHint}</p>
          <ModulesToggle departmentId={dept.id} enabled={dept.modules} />
        </section>
      </div>

      <section className="card mt-[var(--gap)]" aria-labelledby="teams">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="teams" className="card-title flex items-center gap-2">
            {w.teamsTitle}
            <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium">{dept.teams.length}</span>
          </h2>
          <AddTeamButton departmentId={dept.id} />
        </div>
        {dept.teams.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{w.noTeams}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dept.teams.map((team) => (
              <div key={team.id} className="group rounded-[1.25rem] border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-medium">{team.name}</p>
                  <TeamRowControls teamId={team.id} />
                </div>
                <p className="tabular mt-2 text-sm text-muted">{w.colMembers}: {team._count.members}</p>
                {team.leader && (
                  <div className="mt-3 flex items-center gap-2">
                    <Avatar name={team.leader.name ?? "?"} image={team.leader.image} size={24} />
                    <span className="truncate text-xs text-muted">{team.leader.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
