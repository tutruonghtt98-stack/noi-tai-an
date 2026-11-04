import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { getTeamDetail, getWorkspaceAccess } from "@/lib/department-queries";
import { Avatar } from "@/components/ui/avatar";
import { SplitHeading } from "@/components/ui/split-heading";
import { Empty } from "@/components/ui/empty";
import { AddTeamMemberButton } from "./add-team-member-form";
import { RemoveTeamMemberButton } from "./remove-team-member-button";
import { EditTeamButton } from "./edit-team-form";

export const metadata: Metadata = { title: "Nhóm" };

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.departments;
  const { id } = await params;

  const team = await getTeamDetail(id);
  if (!team) notFound();
  const access = await getWorkspaceAccess(team.department.workspaceId, user.id);
  if (!access) notFound();

  return (
    <>
      <Link href={`/departments/teams?w=${team.department.workspaceId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {w.back}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SplitHeading text={team.name} className="text-2xl font-semibold sm:text-[2rem]" />
            <EditTeamButton teamId={team.id} name={team.name} leaderEmail={team.leader?.email ?? null} />
          </div>
          <Link href={`/departments/${team.department.id}?w=${team.department.workspaceId}`} className="mt-2 inline-flex items-center gap-2 text-ink-2 hover:underline">
            {team.department.name}
          </Link>
        </div>
        {team.leader && (
          <div className="flex items-center gap-2">
            <Avatar name={team.leader.name ?? "?"} image={team.leader.image} size={28} />
            <div>
              <p className="text-xs text-muted">{w.colLeader}</p>
              <p className="text-sm font-medium">{team.leader.name}</p>
            </div>
          </div>
        )}
      </div>

      <section className="card" aria-labelledby="team-members">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="team-members" className="card-title flex items-center gap-2">
            {w.teamMembersTitle}
            <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium">{team.members.length}</span>
          </h2>
          <AddTeamMemberButton teamId={team.id} />
        </div>
        {team.members.length === 0 ? (
          <Empty icon={Users2} text={w.emptyTeamMembers} />
        ) : (
          <ul className="space-y-1">
            {team.members.map((m) => (
              <li key={m.id} className="group flex items-center justify-between gap-3 rounded-2xl px-2 py-2.5 hover:bg-surface-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={m.user.name ?? "?"} image={m.user.image} size={32} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.user.name ?? "—"}</p>
                    <p className="truncate text-sm text-muted">{m.user.email}</p>
                  </div>
                </div>
                <RemoveTeamMemberButton teamId={team.id} userId={m.userId} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
