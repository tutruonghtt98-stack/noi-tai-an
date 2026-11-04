import type { Metadata } from "next";
import { Kanban } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { getAccessibleBoards } from "@/lib/work-queries";
import { getUserTeams, getUserWorkspaceMembers } from "@/lib/department-queries";
import { SplitHeading } from "@/components/ui/split-heading";
import { Empty } from "@/components/ui/empty";
import { StaggerReveal } from "@/components/ui/stagger-reveal";
import { BoardHeaderCard, NewBoardButton } from "./board-switcher";
import { KanbanBoard, type SerializedList } from "./kanban-board";
import { WorkspaceLiveSync } from "./live-sync";
import type { ChecklistItem } from "@/lib/work-types";

export const metadata: Metadata = { title: "Workspace" };

function totalCards(lists: { cards: unknown[] }[]): number {
  let n = 0;
  for (const l of lists) n += l.cards.length;
  return n;
}

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.work.workspace;
  const sp = await searchParams;

  const [boards, teams, members] = await Promise.all([getAccessibleBoards(user.id), getUserTeams(user.id), getUserWorkspaceMembers(user.id)]);
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
        <NewBoardButton teams={teamOptions} members={members} />
      </div>

      {boards.length === 0 ? (
        <div className="card">
          <Empty icon={Kanban} text={w.emptyBoards}>
            <NewBoardButton primary teams={teamOptions} members={members} />
          </Empty>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {boards.map((board) => {
            const total = totalCards(board.lists);
            const done = board.lists.find((l) => l.name === "listDone")?.cards.length ?? 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const canManage = board.access === "owner";
            return (
              <div key={board.id}>
                <StaggerReveal asChild={false} slide={{ direction: "up", offset: 16 }}>
                  <BoardHeaderCard
                    board={{
                      id: board.id,
                      name: board.name,
                      description: board.description,
                      dueDate: board.dueDate ? board.dueDate.toISOString() : null,
                      assignee: board.assignee,
                      teamId: board.teamId,
                      sortOrder: board.sortOrder,
                    }}
                    title={board.description || board.name}
                    shared={!canManage}
                    ownerName={!canManage ? board.user.name : null}
                    dueText={dueLabel(board.dueDate) ?? w.noDue}
                    cardsText={fmt(w.cardsCount, { n: total })}
                    progressPct={pct}
                    progressText={fmt(w.progressDone, { done, total })}
                    canManage={canManage}
                    teams={teamOptions}
                    members={members}
                  />
                </StaggerReveal>

                <KanbanBoard
                  lists={board.lists.map(
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
                  canManage={canManage}
                  teams={teamOptions}
                  members={members}
                  openCardId={sp.card}
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
