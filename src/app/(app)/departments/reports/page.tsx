import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { resolveActiveWorkspace } from "@/lib/department-queries";
import { SplitHeading } from "@/components/ui/split-heading";
import { Empty } from "@/components/ui/empty";
import { DepartmentsNav } from "../nav";
import { WorkspaceSwitcher } from "../workspace-switcher";

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = { title: "Báo cáo" };

export default async function DepartmentReportsPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.departments;
  const sp = await searchParams;

  const { active, list } = await resolveActiveWorkspace(user.id, user.name, sp.w);
  const isOwner = active.ownerId === user.id;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <SplitHeading text={w.reportsTitle} className="text-2xl font-semibold sm:text-[2rem]" />
        </div>
      </div>

      <div className="mb-6">
        <WorkspaceSwitcher workspaces={list.map((ws) => ({ id: ws.id, name: ws.name }))} active={active.id} isOwner={isOwner} />
      </div>

      <DepartmentsNav active="reports" workspaceId={active.id} t={w} />

      <section className="card">
        <Empty icon={BarChart3} text={w.reportsSoon} />
      </section>
    </>
  );
}
