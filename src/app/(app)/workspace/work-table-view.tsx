"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { Avatar } from "@/components/ui/avatar";
import { DOT, dueLabel, type SerializedList } from "./kanban-board";
import { CardModal, type SerializedCard } from "./card-modal";
import type { MemberOption } from "./assignee-picker";
import { flattenCards, sortRows, type SortColumn, type SortDir } from "@/lib/work-view";

export function WorkTableView({
  lists,
  canManage = true,
  teams = [],
  members = [],
  timezone,
}: {
  lists: SerializedList[];
  canManage?: boolean;
  teams?: { id: string; name: string }[];
  members?: MemberOption[];
  timezone: string;
}) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const [sortCol, setSortCol] = useState<SortColumn>("due");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [openCard, setOpenCard] = useState<{ card: SerializedCard; listId: string } | null>(null);

  const rows = sortRows(flattenCards(lists), sortCol, sortDir);
  const listOptions = lists.map((l) => ({ id: l.id, name: w[l.name as keyof typeof w] ?? l.name }));
  const doneListId = lists.find((l) => l.name === "listDone")?.id;
  const reviewListId = lists.find((l) => l.name === "listReview")?.id;

  const toggleSort = (column: SortColumn) => {
    if (sortCol === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(column);
      setSortDir("asc");
    }
  };

  return (
    <>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="px-3 py-2" aria-sort={sortCol === "title" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                <button type="button" className="inline-flex items-center gap-1 select-none" onClick={() => toggleSort("title")}>
                  {w.colTitle}
                  {sortCol === "title" && <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span>}
                </button>
              </th>
              <th className="px-3 py-2">{w.colStatus}</th>
              <th className="px-3 py-2">{w.colAssignee}</th>
              <th className="px-3 py-2" aria-sort={sortCol === "due" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                <button type="button" className="inline-flex items-center gap-1 select-none" onClick={() => toggleSort("due")}>
                  {w.colDue}
                  {sortCol === "due" && <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span>}
                </button>
              </th>
              <th className="px-3 py-2">{w.colChecklist}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const total = row.card.checklist.length;
              const done = row.card.checklist.filter((c) => c.done).length;
              const due = dueLabel(w, row.card.dueDate, timezone);
              const open = () => setOpenCard({ card: row.card, listId: row.listId });
              return (
                <tr
                  key={row.card.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-surface-2/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open();
                    }
                  }}
                >
                  <td className="px-3 py-2.5">
                    {row.card.label && <span className="badge mr-2">{row.card.label}</span>}
                    {row.card.title}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span className={`size-2 shrink-0 rounded-full ${DOT[row.listColor] ?? "bg-muted"}`} aria-hidden />
                      {w[row.listName as keyof typeof w] ?? row.listName}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{row.card.assignee ? <Avatar name={row.card.assignee} size={22} /> : "—"}</td>
                  <td className="px-3 py-2.5 text-muted">{due ?? w.noDue}</td>
                  <td className="px-3 py-2.5 text-muted">{total ? `${done}/${total}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
