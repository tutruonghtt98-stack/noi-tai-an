"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";
import { timeInZone, type ISODate } from "@/lib/dates";
import { STATUS_BADGE_CLASS, STATUS_BORDER_CLASS, type SerializedList } from "./kanban-board";
import { CardModal, type SerializedCard } from "./card-modal";
import type { MemberOption } from "./assignee-picker";
import { buildMonthCells, flattenCards, groupCardsByDate, type FlatRow } from "@/lib/work-view";
import { StaggerReveal } from "@/components/ui/stagger-reveal";

const VISIBLE_PER_DAY = 3;

export function WorkCalendarView({
  lists,
  boardListsByBoardId,
  canManageByBoardId,
  teams = [],
  members = [],
  timezone,
  today,
  weekStartsOn,
}: {
  lists: SerializedList[];
  boardListsByBoardId: Record<string, { id: string; name: string }[]>;
  canManageByBoardId: Record<string, boolean>;
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
  const rowCount = cells.length / 7;
  const rows = flattenCards(lists);
  const { byDate, undated } = groupCardsByDate(rows, timezone);
  const boardListsRaw = (openCard && boardListsByBoardId[openCard.card.boardId]) || [];
  const boardLists = boardListsRaw.map((l) => ({ id: l.id, name: w[l.name as keyof typeof w] ?? l.name, rawName: l.name }));
  const doneListId = boardListsRaw.find((l) => l.name === "listDone")?.id;
  const reviewListId = boardListsRaw.find((l) => l.name === "listReview")?.id;
  const canDelete = openCard ? (canManageByBoardId[openCard.card.boardId] ?? false) : true;

  const dtLocale = locale === "en" ? "en-US" : "vi-VN";
  const title = new Intl.DateTimeFormat(dtLocale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  const rangeStart = new Intl.DateTimeFormat(dtLocale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const rangeEnd = new Intl.DateTimeFormat(dtLocale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month, 0)),
  );
  const todayMonthAbbr = new Intl.DateTimeFormat(dtLocale, { month: "short", timeZone: "UTC" }).format(new Date(`${today}T00:00:00Z`));
  const weekOrder = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + weekStartsOn) % 7);

  const chip = (row: FlatRow<SerializedCard>) => {
    const time = row.card.dueDate ? timeInZone(new Date(row.card.dueDate), timezone) : null;
    return (
      <button
        key={row.card.id}
        type="button"
        className={cn(
          "flex w-full items-center justify-between gap-1 truncate rounded-md border px-1.5 py-1 text-left text-xs font-medium",
          STATUS_BADGE_CLASS[row.listColor],
          STATUS_BORDER_CLASS[row.listColor],
        )}
        onClick={() => setOpenCard({ card: row.card, listId: row.card.listId })}
      >
        <span className="truncate">{row.card.title}</span>
        {time && <span className="hidden shrink-0 tabular opacity-80 sm:inline">{time}</span>}
      </button>
    );
  };

  return (
    <>
      <div className="wsx-panel">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex w-14 shrink-0 flex-col items-center rounded-xl border border-line bg-surface-2 py-1.5">
              <span className="text-[0.625rem] font-semibold uppercase text-muted">{todayMonthAbbr}</span>
              <span className="tabular text-lg font-semibold leading-tight">{Number(today.slice(8))}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold capitalize">{title}</h2>
              <p className="text-xs text-muted">{rangeStart} – {rangeEnd}</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-line p-1">
            <button type="button" aria-label={w.calendarPrevMonth} className="icon-btn icon-btn-plain size-8" onClick={() => setMonthOffset((n) => n - 1)}>
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button type="button" className="rounded-full px-3 py-1 text-sm font-medium hover:bg-surface-2" onClick={() => setMonthOffset(0)}>
              {w.calendarToday}
            </button>
            <button type="button" aria-label={w.calendarNextMonth} className="icon-btn icon-btn-plain size-8" onClick={() => setMonthOffset((n) => n + 1)}>
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        {undated.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-muted">{w.calendarUndated}</p>
            <div className="flex flex-wrap gap-1.5">{undated.map(chip)}</div>
          </div>
        )}

        <div className="grid grid-cols-7 text-sm">
          {weekOrder.map((d) => (
            <span key={d} className="pb-2 text-center text-xs font-medium text-ink-2">
              {t.habits.weekdays[d]}
            </span>
          ))}
        </div>
        <StaggerReveal slide={{ direction: "up", offset: 16 }} holdDelay={70}>
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line text-sm">
          {cells.map((iso, i) => {
            const col = i % 7;
            const row = Math.floor(i / 7);
            const cellBorder = cn(col !== 6 && "border-r", row !== rowCount - 1 && "border-b", "border-line");
            if (!iso) return <span key={`e${i}`} className={cn("min-h-24 bg-surface-2/40", cellBorder)} aria-hidden />;
            const dayRows = byDate[iso] ?? [];
            const isToday = iso === today;
            const visible = dayRows.slice(0, VISIBLE_PER_DAY);
            const overflow = dayRows.length - visible.length;
            return (
              <div key={iso} className={cn("flex min-h-24 flex-col gap-1 bg-surface p-1.5", cellBorder)}>
                <span
                  className={cn(
                    "tabular inline-flex size-5 items-center justify-center self-start rounded-full text-xs",
                    isToday ? "bg-ink font-semibold text-bg" : "text-muted",
                  )}
                >
                  {Number(iso.slice(8))}
                </span>
                {visible.map(chip)}
                {overflow > 0 && <span className="px-1.5 text-xs text-muted">{fmt(w.calendarMore, { n: overflow })}</span>}
              </div>
            );
          })}
        </div>
        </StaggerReveal>
      </div>

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
