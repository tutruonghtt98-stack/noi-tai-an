import type { Metadata } from "next";
import { Kanban } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { getWorkBoards } from "@/lib/work-queries";
import { SplitHeading } from "@/components/ui/split-heading";
import { Empty } from "@/components/ui/empty";
import { BoardSwitcher, NewBoardButton } from "./board-switcher";
import { AddCardButton } from "./add-card-button";
import { CardControls } from "./card-controls";

export const metadata: Metadata = { title: "Workspace" };

const DOT: Record<string, string> = { muted: "bg-muted", mist: "bg-mist", ochre: "bg-ochre", jade: "bg-jade" };

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.work.workspace;
  const sp = await searchParams;

  const boards = await getWorkBoards(user.id);
  const active = boards.find((b) => b.id === sp.b) ?? boards[0];

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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SplitHeading text={w.title} className="text-2xl font-semibold sm:text-[2rem]" />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <BoardSwitcher boards={boards.map((b) => ({ id: b.id, name: b.name, cards: b.lists.reduce((n, l) => n + l.cards.length, 0) }))} active={active?.id} />
        <NewBoardButton />
      </div>

      {!active ? (
        <div className="card">
          <Empty icon={Kanban} text={w.emptyBoards}>
            <NewBoardButton primary />
          </Empty>
        </div>
      ) : (
        <>
          <section className="card mb-5 flex flex-wrap items-center justify-between gap-4" aria-label={active.name}>
            <div className="flex items-center gap-3">
              <span className="size-2.5 shrink-0 rounded-full bg-ink" aria-hidden />
              <div>
                <p className="font-semibold">{active.description || active.name}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {dueLabel(active.dueDate) ?? w.noDue} · {fmt(w.cardsCount, { n: active.lists.reduce((n, l) => n + l.cards.length, 0) })}
                </p>
              </div>
            </div>
            {(() => {
              const total = active.lists.reduce((n, l) => n + l.cards.length, 0);
              const done = active.lists.find((l) => l.name === "listDone")?.cards.length ?? 0;
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <div className="flex items-center gap-3">
                  <div className="progress w-32">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <span className="tabular text-sm text-ink-2">{fmt(w.progressDone, { done, total })}</span>
                </div>
              );
            })()}
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {active.lists.map((list) => (
              <div key={list.id} className="flex min-w-0 flex-col gap-3 rounded-[1.5rem] bg-surface-2 p-3">
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
                    <p className="px-2 py-3 text-sm text-muted">{w.emptyList}</p>
                  ) : (
                    list.cards.map((card) => {
                      const pct = card.checklistTotal ? Math.round((card.checklistDone / card.checklistTotal) * 100) : 0;
                      return (
                        <div key={card.id} className="group rounded-2xl bg-surface p-3 shadow-card">
                          {card.label && <span className="badge mb-2">{card.label}</span>}
                          <p className="font-medium leading-snug">{card.title}</p>
                          {card.checklistTotal > 0 && (
                            <div className="mt-2">
                              <p className="tabular text-xs text-muted">
                                {card.checklistDone}/{card.checklistTotal}
                              </p>
                              <div className="progress mt-1">
                                <span style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )}
                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <span className="text-xs text-muted">{dueLabel(card.dueDate) ?? w.noDue}</span>
                            <CardControls
                              cardId={card.id}
                              currentListId={list.id}
                              lists={active.lists.map((l) => ({ id: l.id, name: w[l.name as keyof typeof w] ?? l.name }))}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
