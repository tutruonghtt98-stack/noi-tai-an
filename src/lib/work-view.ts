import { dayOfWeek, isoInZone, monthBounds, rangeISO, type ISODate } from "./dates";

export type WorkView = "kanban" | "table" | "calendar";
const WORK_VIEWS: WorkView[] = ["kanban", "table", "calendar"];

export function parseWorkView(v: string | undefined): WorkView {
  return (WORK_VIEWS as string[]).includes(v ?? "") ? (v as WorkView) : "kanban";
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
