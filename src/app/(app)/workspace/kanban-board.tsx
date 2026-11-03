"use client";
import { useRef, useState } from "react";
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

function CardBody({ w, card }: { w: Dict["work"]["workspace"]; card: SerializedCard }) {
  const total = card.checklist.length;
  const done = card.checklist.filter((c) => c.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const due = dueLabel(w, card.dueDate);
  return (
    <>
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
    </>
  );
}

type PendingDrag = { card: SerializedCard; fromListId: string; startX: number; startY: number; offsetX: number; offsetY: number; width: number };
type ActiveDrag = { card: SerializedCard; x: number; y: number; width: number };

export function KanbanBoard({ lists }: { lists: SerializedList[] }) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const { exec } = useAction();
  const pending = useRef<PendingDrag | null>(null);
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const [overListId, setOverListId] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<{ card: SerializedCard; listId: string } | null>(null);

  const listOptions = lists.map((l) => ({ id: l.id, name: w[l.name as keyof typeof w] ?? l.name }));

  const resetDrag = () => {
    pending.current = null;
    setDrag(null);
    setOverListId(null);
  };

  const onCardPointerDown = (e: React.PointerEvent<HTMLButtonElement>, card: SerializedCard, listId: string) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    pending.current = { card, fromListId: listId, startX: e.clientX, startY: e.clientY, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, width: rect.width };
  };

  const onCardPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = pending.current;
    if (!p) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    if (!drag) {
      if (Math.hypot(dx, dy) < 5) return;
      setDrag({ card: p.card, x: e.clientX - p.offsetX, y: e.clientY - p.offsetY, width: p.width });
    } else {
      setDrag((d) => d && { ...d, x: e.clientX - p.offsetX, y: e.clientY - p.offsetY });
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const listEl = (el as HTMLElement | null)?.closest<HTMLElement>("[data-list-id]");
    setOverListId(listEl?.dataset.listId ?? null);
  };

  const onCardPointerUp = (e: React.PointerEvent<HTMLButtonElement>, card: SerializedCard, listId: string) => {
    const p = pending.current;
    const wasDragging = !!drag;
    if (wasDragging && overListId && overListId !== p?.fromListId) {
      exec(() => moveWorkCard(card.id, overListId));
    } else if (!wasDragging) {
      setOpenCard({ card, listId });
    }
    resetDrag();
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {lists.map((list) => (
          <div
            key={list.id}
            data-list-id={list.id}
            className={cn(
              "flex min-w-0 flex-col gap-3 rounded-[1.5rem] bg-surface-3 p-3 transition-colors",
              overListId === list.id && drag && "ring-2 ring-inset ring-ink/20",
            )}
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
                <p className={cn("rounded-xl px-2 py-3 text-center text-sm text-muted", overListId === list.id && drag && "border border-dashed border-ink/25")}>
                  {overListId === list.id && drag ? w.dropHint : w.emptyList}
                </p>
              ) : (
                list.cards.map((card) => {
                  const isDraggingThis = drag?.card.id === card.id;
                  return (
                    <button
                      type="button"
                      key={card.id}
                      onPointerDown={(e) => onCardPointerDown(e, card, list.id)}
                      onPointerMove={onCardPointerMove}
                      onPointerUp={(e) => onCardPointerUp(e, card, list.id)}
                      onPointerCancel={resetDrag}
                      style={{ touchAction: "none" }}
                      className={cn(
                        "group w-full cursor-grab rounded-2xl p-3 text-left transition-colors active:cursor-grabbing",
                        isDraggingThis ? "border-2 border-dashed border-ink/25 bg-surface-2/70 shadow-none" : "bg-surface shadow-card",
                      )}
                    >
                      <div className={isDraggingThis ? "invisible" : undefined}>
                        <CardBody w={w} card={card} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {drag && (
        <div
          className="pointer-events-none fixed z-[60] rounded-2xl bg-surface p-3 shadow-pop"
          style={{ left: drag.x, top: drag.y, width: drag.width, transform: "rotate(-3deg) scale(1.03)" }}
        >
          <CardBody w={w} card={drag.card} />
        </div>
      )}

      <CardModal open={!!openCard} card={openCard?.card ?? null} listId={openCard?.listId ?? ""} lists={listOptions} onClose={() => setOpenCard(null)} />
    </>
  );
}
