"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { fmt } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";
import { moveWorkCard } from "@/actions/work";
import { Avatar } from "@/components/ui/avatar";
import { StaggerReveal } from "@/components/ui/stagger-reveal";
import { daysBetween, isoInZone, todayISO } from "@/lib/dates";
import { AddCardButton } from "./add-card-button";
import { CardModal, type SerializedCard } from "./card-modal";
import type { MemberOption } from "./assignee-picker";
import type { Dict } from "@/lib/i18n/vi";

export type SerializedList = { id: string; name: string; color: string; cards: SerializedCard[] };

export const DOT: Record<string, string> = { muted: "bg-muted", mist: "bg-mist", ochre: "bg-ochre", jade: "bg-jade", danger: "bg-danger" };

export type WorkCardPriority = "LOW" | "NORMAL" | "URGENT";
export const PRIORITY_BADGE_CLASS: Record<WorkCardPriority, string> = {
  LOW: "bg-jade/15 text-jade-ink",
  NORMAL: "bg-ochre/15 text-ochre-ink",
  URGENT: "bg-danger/15 text-danger",
};

export function dueLabel(w: Dict["work"]["workspace"], due: string | null, timezone: string) {
  if (!due) return null;
  const diffDays = daysBetween(todayISO(timezone), isoInZone(new Date(due), timezone));
  if (diffDays === 0) return w.dueToday;
  if (diffDays > 0) return fmt(w.dueIn, { n: diffDays });
  return fmt(w.overdue, { n: Math.abs(diffDays) });
}

export function CardBody({ w, card, timezone }: { w: Dict["work"]["workspace"]; card: SerializedCard; timezone: string }) {
  const total = card.checklist.length;
  const done = card.checklist.filter((c) => c.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const due = dueLabel(w, card.dueDate, timezone);
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

export function KanbanBoard({
  lists,
  canManage = true,
  teams = [],
  members = [],
  openCardId,
  timezone,
}: {
  lists: SerializedList[];
  canManage?: boolean;
  teams?: { id: string; name: string }[];
  members?: MemberOption[];
  /** Id thẻ cần tự mở popup ngay khi vào trang (vd: bấm "Mở" từ thông báo bình luận). */
  openCardId?: string;
  timezone: string;
}) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const { exec } = useAction();
  const router = useRouter();
  const pending = useRef<PendingDrag | null>(null);
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const [overListId, setOverListId] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<{ card: SerializedCard; listId: string } | null>(null);

  useEffect(() => {
    if (!openCardId) return;
    for (const list of lists) {
      const card = list.cards.find((c) => c.id === openCardId);
      if (card) {
        setOpenCard({ card, listId: list.id });
        break;
      }
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("card");
    router.replace(url.pathname + url.search, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCardId]);

  const listOptions = lists.map((l) => ({ id: l.id, name: w[l.name as keyof typeof w] ?? l.name }));
  const doneListId = lists.find((l) => l.name === "listDone")?.id;
  const reviewListId = lists.find((l) => l.name === "listReview")?.id;

  const resetDrag = () => {
    pending.current = null;
    setDrag(null);
    setOverListId(null);
  };

  const onCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, card: SerializedCard, listId: string) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    pending.current = { card, fromListId: listId, startX: e.clientX, startY: e.clientY, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, width: rect.width };
  };

  const onCardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
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
    const hoveredId = listEl?.dataset.listId ?? null;
    // Người/team được cấp quyền không được kéo thẻ thẳng vào Hoàn thành — phải qua Xem lại rồi chủ bảng duyệt.
    setOverListId(hoveredId && hoveredId === doneListId && !canManage ? null : hoveredId);
  };

  const onCardPointerUp = (e: React.PointerEvent<HTMLDivElement>, card: SerializedCard, listId: string) => {
    const p = pending.current;
    const wasDragging = !!drag;
    if (wasDragging && overListId && overListId !== p?.fromListId) {
      exec(() => moveWorkCard(card.id, overListId));
    } else if (!wasDragging) {
      setOpenCard({ card, listId });
    }
    resetDrag();
  };

  const approveCard = (card: SerializedCard) => {
    if (!doneListId) return;
    exec(() => moveWorkCard(card.id, doneListId), { success: w.cardApproved });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StaggerReveal slide={{ direction: "up", offset: 16 }} holdDelay={70}>
        {lists.map((list) => (
          <div
            key={list.id}
            data-list-id={list.id}
            className={cn(
              "wsx-col flex min-w-0 flex-col gap-3 p-3 transition-colors",
              list.color === "danger" && "border-danger/40 bg-danger/5",
              overListId === list.id && drag && "ring-2 ring-inset ring-ink/20",
            )}
          >
            <div className="flex items-center justify-between gap-2 px-1">
              <span className={cn("inline-flex items-center gap-2 font-medium", list.color === "danger" && "text-danger")}>
                <span className={`size-2 shrink-0 rounded-full ${DOT[list.color] ?? "bg-muted"}`} aria-hidden />
                {w[list.name as keyof typeof w] ?? list.name}
                <span className="tabular text-sm text-muted">{list.cards.length}</span>
              </span>
              {canManage && <AddCardButton listId={list.id} teams={teams} members={members} />}
            </div>

            <div className="flex flex-col gap-2">
              {list.cards.length === 0 ? (
                <p className={cn("rounded-xl px-2 py-3 text-center text-sm text-muted", overListId === list.id && drag && "border border-dashed border-ink/25")}>
                  {overListId === list.id && drag ? w.dropHint : w.emptyList}
                </p>
              ) : (
                list.cards.map((card) => {
                  const isDraggingThis = drag?.card.id === card.id;
                  const showApprove = canManage && list.name === "listReview" && !!doneListId;
                  const locked = list.name === "listDone" && !canManage;
                  return (
                    <div
                      key={card.id}
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) => !locked && onCardPointerDown(e, card, list.id)}
                      onPointerMove={onCardPointerMove}
                      onPointerUp={(e) => onCardPointerUp(e, card, list.id)}
                      onPointerCancel={resetDrag}
                      style={{ touchAction: "none" }}
                      className={cn(
                        "group w-full p-3 text-left transition-colors",
                        locked ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
                        isDraggingThis ? "rounded-lg border-2 border-dashed border-ink/25 bg-surface-2/70 shadow-none" : "wsx-item",
                      )}
                    >
                      <div className={isDraggingThis ? "invisible" : undefined}>
                        <CardBody w={w} card={card} timezone={timezone} />
                        {showApprove && (
                          <button
                            type="button"
                            className="btn btn-soft mt-2.5 w-full !py-1.5 text-xs text-jade-ink"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              approveCard(card);
                            }}
                          >
                            <Check className="size-3.5" aria-hidden /> {w.approveCard}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
        </StaggerReveal>
      </div>

      {drag && (
        <div
          className="pointer-events-none fixed z-[60] rounded-2xl bg-surface p-3 shadow-pop"
          style={{ left: drag.x, top: drag.y, width: drag.width, transform: "rotate(-3deg) scale(1.03)" }}
        >
          <CardBody w={w} card={drag.card} timezone={timezone} />
        </div>
      )}

      <CardModal
        open={!!openCard}
        card={openCard?.card ?? null}
        listId={openCard?.listId ?? ""}
        lists={listOptions}
        teams={teams}
        members={members}
        reviewListId={reviewListId}
        doneListId={doneListId}
        onClose={() => setOpenCard(null)}
        canDelete={canManage}
        timezone={timezone}
      />
    </>
  );
}
