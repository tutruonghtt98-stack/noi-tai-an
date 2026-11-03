import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { resolveActiveWorkspace, getDepartments } from "@/lib/department-queries";
import { SplitHeading } from "@/components/ui/split-heading";
import { Avatar } from "@/components/ui/avatar";
import { Empty } from "@/components/ui/empty";
import { DepartmentsNav } from "../nav";
import { WorkspaceSwitcher } from "../workspace-switcher";
import { DEPT_DOT } from "../colors";
import { AddDepartmentButton } from "./add-department-form";
import { DepartmentRowControls } from "./department-row-controls";

export const metadata: Metadata = { title: "Phòng ban" };

export default async function DepartmentListPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.departments;
  const sp = await searchParams;

  const { active, list } = await resolveActiveWorkspace(user.id, user.name, sp.w);
  const departments = await getDepartments(active.id);
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

      <DepartmentsNav active="departments" workspaceId={active.id} t={w} />

      <section className="card" aria-labelledby="department-list">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="department-list" className="card-title flex items-center gap-2">
            {w.tabDepartments}
            <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium">{departments.length}</span>
          </h2>
          <AddDepartmentButton workspaceId={active.id} />
        </div>

        {departments.length === 0 ? (
          <Empty icon={Building2} text={w.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="pb-3 pr-4 font-medium">{w.colName}</th>
                  <th className="pb-3 pr-4 font-medium">{w.colManager}</th>
                  <th className="pb-3 pr-4 text-right font-medium">{w.colMembers}</th>
                  <th className="pb-3 pr-4 text-right font-medium">{w.colTeams}</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id} className="group border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="py-3 pr-4">
                      <Link href={`/departments/${d.id}?w=${active.id}`} className="flex items-center gap-2 font-medium hover:underline">
                        <span className={`size-2.5 shrink-0 rounded-full ${DEPT_DOT[d.color] ?? "bg-muted"}`} aria-hidden />
                        {d.name}
                      </Link>
                      {d.code && <p className="ml-[1.125rem] text-xs text-muted">{d.code}</p>}
                    </td>
                    <td className="py-3 pr-4">
                      {d.manager ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={d.manager.name ?? "?"} image={d.manager.image} size={24} />
                          <span className="truncate text-ink-2">{d.manager.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted">{w.noManager}</span>
                      )}
                    </td>
                    <td className="tabular py-3 pr-4 text-right">{d._count.members}</td>
                    <td className="tabular py-3 pr-4 text-right">{d._count.teams}</td>
                    <td className="py-3 pl-2 text-right">
                      <DepartmentRowControls departmentId={d.id} canDelete={isOwner} />
                    </td>
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
