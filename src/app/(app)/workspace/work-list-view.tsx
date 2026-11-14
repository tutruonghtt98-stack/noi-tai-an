"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { STATUS_BADGE_CLASS, STATUS_ICON, PRIORITY_BADGE_CLASS, dueLabel, type SerializedList } from "./kanban-board";
import { CardModal, type SerializedCard } from "./card-modal";
import type { MemberOption } from "./assignee-picker";
import { reorderIds } from "@/lib/work-view";
import { reorderWorkCards } from "@/actions/work";

export function WorkListView({
  lists,
  boardListsByBoardId,
  canManageByBoardId,
  teams = [],
  members = [],
  timezone,
  openCardId,
}: {
  lists: SerializedList[];
  boardListsByBoardId: Record<string, { id: string; name: string }[]>;
  canManageByBoardId: Record<string, boolean>;
  teams?: { id: string; name: string }[];
  members?: MemberOption[];
  timezone: string;
  openCardId?: string;
}) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const router = useRouter();
  const { exec } = useAction();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [openCard, setOpenCard] = useState<{ card: SerializedCard; listId: string } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    if (!openCardId) return;
    for (const list of lists) {
      const card = list.cards.find((c) => c.id === openCardId);
      if (card) {
        setOpenCard({ card, listId: card.listId });
        break;
      }
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("card");
    router.replace(url.pathname + url.search, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCardId]);

  const priorityLabel: Record<SerializedCard["priority"], string> = {
    LOW: w.priorityLow,
    NORMAL: w.priorityNormal,
    URGENT: w.priorityUrgent,
  };

  const open = (card: SerializedCard) => setOpenCard({ card, listId: card.listId });

  const boardListsRaw = (openCard && boardListsByBoardId[openCard.card.boardId]) || [];
  const boardLists = boardListsRaw.map((l) => ({ id: l.id, name: w[l.name as keyof typeof w] ?? l.name }));
  const doneListId = boardListsRaw.find((l) => l.name === "listDone")?.id;
  const reviewListId = boardListsRaw.find((l) => l.name === "listReview")?.id;
  const canDelete = openCard ? (canManageByBoardId[openCard.card.boardId] ?? false) : true;

  return (
    <>
      {lists.map((list) => {
        const Icon = STATUS_ICON[list.name] ?? undefined;
        return (
        <div key={list.name} className="wsx-panel mb-4">
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left"
            onClick={() => setCollapsed((c) => ({ ...c, [list.name]: !c[list.name] }))}
          >
            <span className={cn("badge inline-flex items-center gap-1.5", STATUS_BADGE_CLASS[list.color])}>
              {Icon && <Icon className="size-3.5" aria-hidden />}
              {w[list.name as keyof typeof w] ?? list.name}
            </span>
            <span className="tabular text-muted">({list.cards.length})</span>
            {collapsed[list.name] ? (
              <ChevronRight className="ml-auto size-4" aria-hidden />
            ) : (
              <ChevronDown className="ml-auto size-4" aria-hidden />
            )}
          </button>

          {!collapsed[list.name] &&
            (list.cards.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{w.emptyList}</p>
            ) : (
              <table className="mt-3 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-muted">
                    <th className="w-8 px-1 py-2" />
                    <th className="px-3 py-2">{w.colTitle}</th>
                    <th className="px-3 py-2">{w.colAssignee}</th>
                    <th className="px-3 py-2">{w.typeTitle}</th>
                    <th className="px-3 py-2">{w.timelineTitle}</th>
                    <th className="px-3 py-2">{w.colPriority}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.cards.map((card) => {
                    const due = dueLabel(w, card.dueDate, timezone);
                    return (
                      <tr
                        key={card.id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-surface-2/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                        onClick={() => open(card)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            open(card);
                          }
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!draggedId || draggedId === card.id) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const position = e.clientY > rect.top + rect.height / 2 ? "after" : "before";
                          const ids = list.cards.map((c) => c.id);
                          const next = reorderIds(ids, draggedId, card.id, position);
                          exec(() => reorderWorkCards(next));
                          setDraggedId(null);
                        }}
                      >
                        <td className="px-1 py-2.5">
                          <span
                            draggable
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              setDraggedId(card.id);
                            }}
                            aria-label={w.dragHandleLabel}
                            className="inline-flex cursor-grab text-muted active:cursor-grabbing"
                          >
                            <GripVertical className="size-4" aria-hidden />
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {card.label && <span className="badge mr-2">{card.label}</span>}
                          {card.title}
                        </td>
                        <td className="px-3 py-2.5">{card.assignee ? <Avatar name={card.assignee} size={22} /> : "—"}</td>
                        <td className="px-3 py-2.5 text-muted">{card.label || "—"}</td>
                        <td className="px-3 py-2.5 text-muted">{due ?? w.noDue}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn("badge", PRIORITY_BADGE_CLASS[card.priority])}>{priorityLabel[card.priority]}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
        </div>
        );
      })}

      <CardModal
        open={!!openCard}
        card={openCard?.card ?? null}
        listId={openCard?.listId ?? ""}
        lists={boardLists}
        teams={teams}
        members={members}
        reviewListId={reviewListId}
        doneListId={doneListId}
        onClose={() => setOpenCard(null)}
        canDelete={canDelete}
        timezone={timezone}
      />
    </>
  );
}
