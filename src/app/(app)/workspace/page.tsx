import type { Metadata } from "next";
import { Kanban } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { getWorkBoards, getAssignedCards, getAssignedCardsCount } from "@/lib/work-queries";
import { SplitHeading } from "@/components/ui/split-heading";
import { Empty } from "@/components/ui/empty";
import { BoardSwitcher, NewBoardButton, DeleteBoardButton } from "./board-switcher";
import { KanbanBoard, type SerializedList } from "./kanban-board";
import { AssignedList, type AssignedCardView } from "./assigned/assigned-list";
import type { ChecklistItem } from "@/lib/work-types";
import type { Dict } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.work.workspace;
  const sp = await searchParams;
  const showAssigned = sp.b === "assigned";

  const [boards, assignedCount, assignedCards] = await Promise.all([
    getWorkBoards(user.id),
    getAssignedCardsCount(user.id),
    showAssigned ? getAssignedCards(user.id) : Promise.resolve([]),
  ]);
  const active = showAssigned ? undefined : (boards.find((b) => b.id === sp.b) ?? boards[0]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueLabel = (due: Date | null) => {
    if (!due) return null;
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) return w.dueToday;
    if (diffDays > 0) return fmt(w.dueIn, { n: diffDays });
    return fmt(w.overdue, { n: Math.abs(diffDays) });
  };

  const assignedItems: AssignedCardView[] = assignedCards.map((c) => ({
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

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <BoardSwitcher
          boards={boards.map((b) => ({ id: b.id, name: b.name, cards: b.lists.reduce((n, l) => n + l.cards.length, 0) }))}
          active={showAssigned ? "assigned" : active?.id}
          assignedCount={assignedCount}
        />
        <NewBoardButton />
      </div>

      {showAssigned ? (
        <section className="card" aria-label={w.assignedToMe}>
          <AssignedList items={assignedItems} />
        </section>
      ) : !active ? (
        <div className="card">
          <Empty icon={Kanban} text={w.emptyBoards}>
            <NewBoardButton primary />
          </Empty>
        </div>
      ) : (
        <>
          <section className="card mb-5 flex flex-wrap items-center justify-between gap-4" aria-label={active.name}>
            <div className="flex items-center gap-3">
              <span className="size-2.5 shrink-0 rounded-full bg-ink" aria-hidden />
              <div>
                <p className="font-semibold">{active.description || active.name}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {dueLabel(active.dueDate) ?? w.noDue} · {fmt(w.cardsCount, { n: active.lists.reduce((n, l) => n + l.cards.length, 0) })}
                </p>
              </div>
            </div>
            {(() => {
              const total = active.lists.reduce((n, l) => n + l.cards.length, 0);
              const done = active.lists.find((l) => l.name === "listDone")?.cards.length ?? 0;
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <div className="flex items-center gap-3">
                  <div className="progress w-32">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <span className="tabular text-sm text-ink-2">{fmt(w.progressDone, { done, total })}</span>
                  <DeleteBoardButton boardId={active.id} />
                </div>
              );
            })()}
          </section>

          <KanbanBoard
            lists={active.lists.map(
              (list): SerializedList => ({
                id: list.id,
                name: list.name,
                color: list.color,
                cards: list.cards.map((card) => ({
                  id: card.id,
                  label: card.label,
                  title: card.title,
                  assignee: card.assignee,
                  dueDate: card.dueDate ? card.dueDate.toISOString() : null,
                  checklist: Array.isArray(card.checklist) ? (card.checklist as unknown as ChecklistItem[]) : [],
                })),
              }),
            )}
          />
        </>
      )}
    </>
  );
}
