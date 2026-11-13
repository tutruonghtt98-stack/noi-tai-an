import type { Metadata } from "next";
import { Kanban } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { getAccessibleBoards, DEFAULT_LISTS } from "@/lib/work-queries";
import { getUserTeams, getUserWorkspaceMembers } from "@/lib/department-queries";
import { todayISO } from "@/lib/dates";
import { SplitHeading } from "@/components/ui/split-heading";
import { Empty } from "@/components/ui/empty";
import { ViewSwitcher } from "./view-switcher";
import { WorkListView } from "./work-list-view";
import { WorkCalendarView } from "./work-calendar-view";
import { NewTaskButton } from "./new-task-button";
import { NewBoardButton } from "./board-switcher";
import { WorkspaceLiveSync } from "./live-sync";
import { parseWorkView, poolListsByName } from "@/lib/work-view";
import type { ChecklistItem } from "@/lib/work-types";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ card?: string; v?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.work.workspace;
  const sp = await searchParams;
  const view = parseWorkView(sp.v);

  const [boards, teams, members] = await Promise.all([getAccessibleBoards(user.id), getUserTeams(user.id), getUserWorkspaceMembers(user.id)]);
  const teamOptions = teams.map((t) => ({ id: t.id, name: t.department ? `${t.department.name} / ${t.name}` : t.name }));
  const today = todayISO(user.timezone);

  const boardsForList = boards.map((b) => ({
    id: b.id,
    name: b.name,
    lists: b.lists.map((l) => ({ id: l.id, name: l.name })),
  }));
  const boardListsByBoardId = Object.fromEntries(boardsForList.map((b) => [b.id, b.lists]));
  const canManageByBoardId = Object.fromEntries(boards.map((b) => [b.id, b.access === "owner"]));
  const ownedBoardsForNewTask = boardsForList.filter((b) => canManageByBoardId[b.id]);

  const pooled = poolListsByName(
    boards.map((b) =>
      b.lists.map((list) => ({
        name: list.name,
        color: list.color,
        cards: list.cards.map((card) => ({
          id: card.id,
          boardId: b.id,
          listId: card.listId,
          label: card.label,
          title: card.title,
          assignee: card.assignee,
          teamId: card.teamId,
          dueDate: card.dueDate ? card.dueDate.toISOString() : null,
          startDate: card.startDate ? card.startDate.toISOString() : null,
          priority: card.priority,
          checklist: Array.isArray(card.checklist) ? (card.checklist as unknown as ChecklistItem[]) : [],
        })),
      })),
    ),
    DEFAULT_LISTS,
  );
  const lists = pooled.map((l) => ({ id: l.name, name: l.name, color: l.color, cards: l.cards }));

  const hasNoBoards = !boards.length;

  return (
    <>
      <WorkspaceLiveSync />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SplitHeading text={w.title} className="text-2xl font-semibold sm:text-[2rem]" />
        <div className="flex items-center gap-2">
          {ownedBoardsForNewTask.length > 0 && <NewTaskButton boards={ownedBoardsForNewTask} teams={teamOptions} members={members} />}
          {!hasNoBoards && <NewBoardButton teams={teamOptions} members={members} />}
        </div>
      </div>

      {hasNoBoards ? (
        <div className="card">
          <Empty icon={Kanban} text={w.emptyBoards}>
            <NewBoardButton primary teams={teamOptions} members={members} />
          </Empty>
        </div>
      ) : (
        <>
          <ViewSwitcher w={w} current={view} />
          {view === "list" ? (
            <WorkListView
              lists={lists}
              boardListsByBoardId={boardListsByBoardId}
              canManageByBoardId={canManageByBoardId}
              teams={teamOptions}
              members={members}
              timezone={user.timezone}
              openCardId={sp.card}
            />
          ) : (
            <WorkCalendarView
              lists={lists}
              boardListsByBoardId={boardListsByBoardId}
              canManageByBoardId={canManageByBoardId}
              teams={teamOptions}
              members={members}
              timezone={user.timezone}
              today={today}
              weekStartsOn={user.weekStartsOn}
            />
          )}
        </>
      )}
    </>
  );
}
