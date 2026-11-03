import type { Metadata } from "next";
import { Kanban } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { getAccessibleBoards } from "@/lib/work-queries";
import { getUserTeams } from "@/lib/department-queries";
import { SplitHeading } from "@/components/ui/split-heading";
import { Empty } from "@/components/ui/empty";
import { BoardSwitcher, NewBoardButton, DeleteBoardButton } from "./board-switcher";
import { KanbanBoard, type SerializedList } from "./kanban-board";
import { WorkspaceLiveSync } from "./live-sync";
import type { ChecklistItem } from "@/lib/work-types";

export const metadata: Metadata = { title: "Workspace" };

function totalCards(lists: { cards: unknown[] }[]): number {
  let n = 0;
  for (const l of lists) n += l.cards.length;
  return n;
}

function inProgressCount(lists: { name: string; cards: unknown[] }[]): number {
  return lists.find((l) => l.name === "listInProgress")?.cards.length ?? 0;
}

function overdueCount(lists: { name: string; cards: unknown[] }[]): number {
  return lists.find((l) => l.name === "listOverdue")?.cards.length ?? 0;
}

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.work.workspace;
  const sp = await searchParams;

  const [boards, teams] = await Promise.all([getAccessibleBoards(user.id), getUserTeams(user.id)]);
  const active = boards.find((b) => b.id === sp.b) ?? boards[0];
  const teamOptions = teams.map((t) => ({ id: t.id, name: t.department ? `${t.department.name} / ${t.name}` : t.name }));

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
      <WorkspaceLiveSync />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SplitHeading text={w.title} className="text-2xl font-semibold sm:text-[2rem]" />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <BoardSwitcher
          boards={boards.map((b) => ({ id: b.id, name: b.name, inProgress: inProgressCount(b.lists), overdue: overdueCount(b.lists) }))}
          active={active?.id}
        />
        <NewBoardButton teams={teamOptions} />
      </div>

      {!active ? (
        <div className="card">
          <Empty icon={Kanban} text={w.emptyBoards}>
            <NewBoardButton primary teams={teamOptions} />
          </Empty>
        </div>
      ) : (
        <>
          <section className="card mb-5 flex flex-wrap items-center justify-between gap-4" aria-label={active.name}>
            <div className="flex items-center gap-3">
              <span className="size-2.5 shrink-0 rounded-full bg-ink" aria-hidden />
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  {active.description || active.name}
                  {active.access !== "owner" && <span className="chip chip-soft text-xs">{w.sharedBoardBadge}</span>}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {dueLabel(active.dueDate) ?? w.noDue} · {fmt(w.cardsCount, { n: totalCards(active.lists) })}
                  {active.access !== "owner" && active.user.name ? ` · ${fmt(w.ownerLabel, { name: active.user.name })}` : ""}
                </p>
              </div>
            </div>
            {(() => {
              const total = totalCards(active.lists);
              const done = active.lists.find((l) => l.name === "listDone")?.cards.length ?? 0;
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <div className="flex items-center gap-3">
                  <div className="progress w-32">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <span className="tabular text-sm text-ink-2">{fmt(w.progressDone, { done, total })}</span>
                  {active.access === "owner" && <DeleteBoardButton boardId={active.id} />}
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
                  teamId: card.teamId,
                  dueDate: card.dueDate ? card.dueDate.toISOString() : null,
                  checklist: Array.isArray(card.checklist) ? (card.checklist as unknown as ChecklistItem[]) : [],
                })),
              }),
            )}
            canManage={active.access === "owner"}
            teams={teamOptions}
          />
        </>
      )}
    </>
  );
}
