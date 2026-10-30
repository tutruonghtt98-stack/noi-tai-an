"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { fmt } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";
import { moveWorkCard } from "@/actions/work";
import { Avatar } from "@/components/ui/avatar";
import { AddCardButton } from "./add-card-button";
import { CardModal, type SerializedCard } from "./card-modal";
import type { Dict } from "@/lib/i18n/vi";

export type SerializedList = { id: string; name: string; color: string; cards: SerializedCard[] };

const DOT: Record<string, string> = { muted: "bg-muted", mist: "bg-mist", ochre: "bg-ochre", jade: "bg-jade" };

function dueLabel(w: Dict["work"]["workspace"], due: string | null) {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((new Date(due).getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return w.dueToday;
  if (diffDays > 0) return fmt(w.dueIn, { n: diffDays });
  return fmt(w.overdue, { n: Math.abs(diffDays) });
}

export function KanbanBoard({ lists }: { lists: SerializedList[] }) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const { exec } = useAction();
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [overListId, setOverListId] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<{ card: SerializedCard; listId: string } | null>(null);

  const listOptions = lists.map((l) => ({ id: l.id, name: w[l.name as keyof typeof w] ?? l.name }));

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {lists.map((list) => (
          <div
            key={list.id}
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-[1.5rem] bg-surface-2 p-3 transition-colors",
              overListId === list.id && dragCardId && "bg-surface-3 ring-2 ring-inset ring-ink/15",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              if (overListId !== list.id) setOverListId(list.id);
            }}
            onDragLeave={() => setOverListId((v) => (v === list.id ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              const cardId = e.dataTransfer.getData("text/plain");
              setOverListId(null);
              setDragCardId(null);
              if (cardId) exec(() => moveWorkCard(cardId, list.id));
            }}
          >
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="inline-flex items-center gap-2 font-medium">
                <span className={`size-2 shrink-0 rounded-full ${DOT[list.color] ?? "bg-muted"}`} aria-hidden />
                {w[list.name as keyof typeof w] ?? list.name}
                <span className="tabular text-sm text-muted">{list.cards.length}</span>
              </span>
              <AddCardButton listId={list.id} />
            </div>

            <div className="flex flex-col gap-2">
              {list.cards.length === 0 ? (
                <p className={cn("rounded-xl px-2 py-3 text-center text-sm text-muted", overListId === list.id && dragCardId && "border border-dashed border-ink/20")}>
                  {overListId === list.id && dragCardId ? w.dropHint : w.emptyList}
                </p>
              ) : (
                list.cards.map((card) => {
                  const total = card.checklist.length;
                  const done = card.checklist.filter((c) => c.done).length;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  const due = dueLabel(w, card.dueDate);
                  return (
                    <button
                      type="button"
                      key={card.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", card.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragCardId(card.id);
                      }}
                      onDragEnd={() => {
                        setDragCardId(null);
                        setOverListId(null);
                      }}
                      onClick={() => setOpenCard({ card, listId: list.id })}
                      className={cn(
                        "group w-full cursor-grab rounded-2xl bg-surface p-3 text-left shadow-card transition-opacity active:cursor-grabbing",
                        dragCardId === card.id && "opacity-40",
                      )}
                    >
                      {card.label && <span className="badge mb-2">{card.label}</span>}
                      <p className="font-medium leading-snug">{card.title}</p>
                      {total > 0 && (
                        <div className="mt-2">
                          <p className="tabular text-xs text-muted">
                            {done}/{total}
                          </p>
                          <div className="progress mt-1">
                            <span style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted">{due ?? w.noDue}</span>
                        {card.assignee && <Avatar name={card.assignee} size={24} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      <CardModal open={!!openCard} card={openCard?.card ?? null} listId={openCard?.listId ?? ""} lists={listOptions} onClose={() => setOpenCard(null)} />
    </>
  );
}
