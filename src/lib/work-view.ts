import { dayOfWeek, isoInZone, monthBounds, rangeISO, type ISODate } from "./dates";

export type WorkView = "kanban" | "list" | "calendar";
const WORK_VIEWS: WorkView[] = ["kanban", "list", "calendar"];

export function parseWorkView(v: string | undefined): WorkView {
  return (WORK_VIEWS as string[]).includes(v ?? "") ? (v as WorkView) : "list";
}

export type PoolableList<TCard> = { name: string; color: string; cards: TCard[] };

export function poolListsByName<TCard extends { sortOrder: number }>(
  boardsLists: PoolableList<TCard>[][],
  order: { name: string; color: string }[],
): PoolableList<TCard>[] {
  return order.map(({ name, color }) => {
    const cards = boardsLists.flatMap((lists) => lists.find((l) => l.name === name)?.cards ?? []);
    cards.sort((a, b) => a.sortOrder - b.sortOrder);
    return { name, color, cards };
  });
}

export type FlattenableList<TCard> = { id: string; name: string; color: string; cards: TCard[] };
export type FlatRow<TCard> = { listId: string; listName: string; listColor: string; card: TCard };

export function flattenCards<TCard>(lists: FlattenableList<TCard>[]): FlatRow<TCard>[] {
  return lists.flatMap((l) => l.cards.map((card) => ({ listId: l.id, listName: l.name, listColor: l.color, card })));
}

export type SortColumn = "title" | "due";
export type SortDir = "asc" | "desc";

export function sortRows<TCard extends { title: string; dueDate: string | null }>(
  rows: FlatRow<TCard>[],
  column: SortColumn,
  dir: SortDir,
): FlatRow<TCard>[] {
  const copy = [...rows];
  if (column === "due") {
    const dated = copy.filter((r) => r.card.dueDate !== null);
    const undated = copy.filter((r) => r.card.dueDate === null);
    dated.sort((a, b) => {
      const diff = Date.parse(a.card.dueDate as string) - Date.parse(b.card.dueDate as string);
      return dir === "asc" ? diff : -diff;
    });
    return [...dated, ...undated];
  }
  copy.sort((a, b) => {
    const diff = a.card.title.localeCompare(b.card.title);
    return dir === "asc" ? diff : -diff;
  });
  return copy;
}

export function buildMonthCells(year: number, month: number, weekStartsOn: number): (ISODate | null)[] {
  const { from, to } = monthBounds(year, month);
  const all = rangeISO(from, to);
  const lead = (dayOfWeek(from) - weekStartsOn + 7) % 7;
  const cells: (ISODate | null)[] = [...Array(lead).fill(null), ...all];
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function reorderIds(
  ids: string[],
  draggedId: string,
  targetId: string,
  position: "before" | "after" = "before",
): string[] {
  if (draggedId === targetId || !ids.includes(draggedId) || !ids.includes(targetId)) return [...ids];
  const without = ids.filter((id) => id !== draggedId);
  const targetIndex = without.indexOf(targetId);
  const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
  return [...without.slice(0, insertIndex), draggedId, ...without.slice(insertIndex)];
}

export function groupCardsByDate<TCard extends { dueDate: string | null }>(
  rows: FlatRow<TCard>[],
  timezone: string,
): { byDate: Record<ISODate, FlatRow<TCard>[]>; undated: FlatRow<TCard>[] } {
  const byDate: Record<ISODate, FlatRow<TCard>[]> = {};
  const undated: FlatRow<TCard>[] = [];
  for (const row of rows) {
    if (row.card.dueDate === null) {
      undated.push(row);
      continue;
    }
    const iso = isoInZone(new Date(row.card.dueDate), timezone);
    (byDate[iso] ??= []).push(row);
  }
  return { byDate, undated };
}
