import type { Metadata } from "next";
import { Kanban } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { getWorkBoards } from "@/lib/work-queries";
import { SplitHeading } from "@/components/ui/split-heading";
import { Empty } from "@/components/ui/empty";
import { BoardSwitcher, NewBoardButton, DeleteBoardButton } from "./board-switcher";
import { KanbanBoard, type SerializedList } from "./kanban-board";
import type { ChecklistItem } from "@/lib/work-types";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.work.workspace;
  const sp = await searchParams;

  const boards = await getWorkBoards(user.id);
  const active = boards.find((b) => b.id === sp.b) ?? boards[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueLabel = (due: Date | null) => {
    if (!due) return null;
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) return w.dueToday;
    if (diffDays > 0) return fmt(w.dueIn, { n: diffDays });
    return fmt(w.overdue, { n: Math.abs(diffDays) });
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SplitHeading text={w.title} className="text-2xl font-semibold sm:text-[2rem]" />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <BoardSwitcher boards={boards.map((b) => ({ id: b.id, name: b.name, cards: b.lists.reduce((n, l) => n + l.cards.length, 0) }))} active={active?.id} />
        <NewBoardButton />
      </div>

      {!active ? (
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
