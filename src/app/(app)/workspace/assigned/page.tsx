import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { getAssignedCards } from "@/lib/work-queries";
import { SplitHeading } from "@/components/ui/split-heading";
import { ViewSwitcher } from "../view-switcher";
import { AssignedList, type AssignedCardView } from "./assigned-list";
import type { ChecklistItem } from "@/lib/work-types";
import type { Dict } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: "Workspace" };

export default async function AssignedWorkspacePage() {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.work.workspace;

  const cards = await getAssignedCards(user.id);

  const items: AssignedCardView[] = cards.map((c) => ({
    card: {
      id: c.id,
      label: c.label,
      title: c.title,
      assignee: c.assignee,
      dueDate: c.dueDate ? c.dueDate.toISOString() : null,
      checklist: Array.isArray(c.checklist) ? (c.checklist as unknown as ChecklistItem[]) : [],
    },
    listId: c.listId,
    listName: w[c.list.name as keyof Dict["work"]["workspace"]] ?? c.list.name,
    ownerName: c.list.board.user.name,
    ownerImage: c.list.board.user.image,
    boardLists: c.list.board.lists.map((l) => ({ id: l.id, name: w[l.name as keyof Dict["work"]["workspace"]] ?? l.name })),
  }));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SplitHeading text={w.title} className="text-2xl font-semibold sm:text-[2rem]" />
      </div>

      <div className="mb-6">
        <ViewSwitcher active="assigned" assignedCount={items.length} w={w} />
      </div>

      <section className="card" aria-label={w.assignedToMe}>
        <AssignedList items={items} />
      </section>
    </>
  );
}
