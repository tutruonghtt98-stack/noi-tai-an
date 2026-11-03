import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { resolveActiveWorkspace, getWorkspaceMembers } from "@/lib/department-queries";
import { Avatar } from "@/components/ui/avatar";
import { SplitHeading } from "@/components/ui/split-heading";
import { Empty } from "@/components/ui/empty";
import { Users2 } from "lucide-react";
import { DepartmentsNav } from "../nav";
import { WorkspaceSwitcher } from "../workspace-switcher";
import { InviteMemberButton } from "./invite-form";
import { WorkspaceMemberRow } from "./member-row";

export const metadata: Metadata = { title: "Thành viên" };

export default async function WorkspaceMembersPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.departments;
  const sp = await searchParams;

  const { active, list } = await resolveActiveWorkspace(user.id, user.name, sp.w);
  const { owner, members } = await getWorkspaceMembers(active.id);
  const isOwner = active.ownerId === user.id;
  const totalMembers = new Set([owner?.id, ...members.map((m) => m.userId)].filter(Boolean)).size;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <SplitHeading text={w.membersPageTitle} className="text-2xl font-semibold sm:text-[2rem]" />
          <p className="mt-2 text-ink-2">{w.membersPageSubtitle}</p>
        </div>
      </div>

      <div className="mb-6">
        <WorkspaceSwitcher workspaces={list.map((ws) => ({ id: ws.id, name: ws.name }))} active={active.id} isOwner={isOwner} />
      </div>

      <DepartmentsNav active="members" workspaceId={active.id} t={w} />

      <section className="card" aria-labelledby="ws-members">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="ws-members" className="card-title flex items-center gap-2">
            {w.membersPageTitle}
            <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium">{totalMembers}</span>
          </h2>
          {isOwner && <InviteMemberButton workspaceId={active.id} />}
        </div>

        <ul className="space-y-2">
          {owner && (
            <li className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
              <Avatar name={owner.name ?? "?"} image={owner.image} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{owner.name ?? owner.email}</p>
                <p className="truncate text-xs text-muted">{owner.email}</p>
              </div>
              <span className="badge">{w.roleOwner}</span>
            </li>
          )}
          {members
            .filter((m) => m.userId !== owner?.id)
            .map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
                <Avatar name={m.user.name ?? "?"} image={m.user.image} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.user.name ?? m.user.email}</p>
                  <p className="truncate text-xs text-muted">{m.user.email}</p>
                </div>
                {isOwner ? (
                  <WorkspaceMemberRow workspaceId={active.id} userId={m.userId} email={m.user.email ?? ""} role={m.role as "ADMIN" | "MEMBER"} />
                ) : (
                  <span className="badge">{m.role === "ADMIN" ? w.roleAdmin : w.roleMember}</span>
                )}
              </li>
            ))}
        </ul>
        {members.length === 0 && <Empty icon={Users2} text={w.noMembers} />}
      </section>
    </>
  );
}
