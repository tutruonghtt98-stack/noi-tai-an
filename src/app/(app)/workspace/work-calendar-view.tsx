"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import type { ISODate } from "@/lib/dates";
import { DOT, type SerializedList } from "./kanban-board";
import { CardModal, type SerializedCard } from "./card-modal";
import type { MemberOption } from "./assignee-picker";
import { buildMonthCells, flattenCards, groupCardsByDate, type FlatRow } from "@/lib/work-view";

export function WorkCalendarView({
  lists,
  canManage = true,
  teams = [],
  members = [],
  timezone,
  today,
  weekStartsOn,
}: {
  lists: SerializedList[];
  canManage?: boolean;
  teams?: { id: string; name: string }[];
  members?: MemberOption[];
  timezone: string;
  today: ISODate;
  weekStartsOn: number;
}) {
  const { t, locale } = useI18n();
  const w = t.work.workspace;
  const [monthOffset, setMonthOffset] = useState(0);
  const [openCard, setOpenCard] = useState<{ card: SerializedCard; listId: string } | null>(null);

  const [y0, m0] = today.split("-").map(Number);
  const base = new Date(Date.UTC(y0, m0 - 1 + monthOffset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;

  const cells = buildMonthCells(year, month, weekStartsOn);
  const rows = flattenCards(lists);
  const { byDate, undated } = groupCardsByDate(rows, timezone);
  const listOptions = lists.map((l) => ({ id: l.id, name: w[l.name as keyof typeof w] ?? l.name }));
  const doneListId = lists.find((l) => l.name === "listDone")?.id;
  const reviewListId = lists.find((l) => l.name === "listReview")?.id;

  const title = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  const weekOrder = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + weekStartsOn) % 7);

  const chip = (row: FlatRow<SerializedCard>) => (
    <button
      key={row.card.id}
      type="button"
      className="flex w-full items-center gap-1.5 truncate rounded-md border border-line bg-surface px-1.5 py-1 text-left text-xs"
      onClick={() => setOpenCard({ card: row.card, listId: row.listId })}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${DOT[row.listColor] ?? "bg-muted"}`} aria-hidden />
      <span className="truncate">{row.card.title}</span>
    </button>
  );

  return (
    <>
      <div className="wsx-panel">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button type="button" aria-label={w.calendarPrevMonth} className="btn btn-soft !p-2" onClick={() => setMonthOffset((n) => n - 1)}>
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="rounded-full bg-surface-2 px-4 py-2 text-sm font-medium capitalize">{title}</span>
          <button type="button" aria-label={w.calendarNextMonth} className="btn btn-soft !p-2" onClick={() => setMonthOffset((n) => n + 1)}>
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>

        {undated.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-muted">{w.calendarUndated}</p>
            <div className="flex flex-wrap gap-1.5">{undated.map(chip)}</div>
          </div>
        )}

        <div className="grid grid-cols-7 gap-1.5 text-sm sm:gap-2">
          {weekOrder.map((d) => (
            <span key={d} className="pb-1 text-center text-xs font-medium text-ink-2">
              {t.habits.weekdays[d]}
            </span>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <span key={`e${i}`} className="min-h-20 rounded-lg border border-transparent" aria-hidden />;
            const dayRows = byDate[iso] ?? [];
            return (
              <div
                key={iso}
                className={cn("wsx-cell flex min-h-20 flex-col gap-1 p-1.5", iso === today && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
              >
                <span className="tabular px-0.5 text-xs text-muted">{Number(iso.slice(8))}</span>
                {dayRows.map(chip)}
              </div>
            );
          })}
        </div>
      </div>

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
