import { test } from "node:test";
import assert from "node:assert/strict";
import { dayOfWeek, monthBounds } from "./dates";
import { parseWorkView, flattenCards, sortRows, buildMonthCells, groupCardsByDate } from "./work-view";

test("parseWorkView returns the value when valid", () => {
  assert.equal(parseWorkView("table"), "table");
  assert.equal(parseWorkView("calendar"), "calendar");
  assert.equal(parseWorkView("kanban"), "kanban");
});

test("parseWorkView defaults to kanban for missing or invalid values", () => {
  assert.equal(parseWorkView(undefined), "kanban");
  assert.equal(parseWorkView(""), "kanban");
  assert.equal(parseWorkView("xyz"), "kanban");
});

type TestCard = { id: string; title: string; dueDate: string | null };
const lists = [
  { id: "l1", name: "listToDo", color: "mist", cards: [{ id: "a", title: "B card", dueDate: "2026-11-20T00:00:00.000Z" } as TestCard] },
  { id: "l2", name: "listDone", color: "jade", cards: [
    { id: "b", title: "A card", dueDate: null } as TestCard,
    { id: "c", title: "C card", dueDate: "2026-11-05T00:00:00.000Z" } as TestCard,
  ] },
];

test("flattenCards preserves list identity on every row, in list-then-card order", () => {
  const rows = flattenCards(lists);
  assert.deepEqual(rows.map((r) => r.card.id), ["a", "b", "c"]);
  assert.equal(rows[0].listId, "l1");
  assert.equal(rows[0].listName, "listToDo");
  assert.equal(rows[0].listColor, "mist");
});

test("sortRows by due date ascending puts undated cards last", () => {
  const rows = sortRows(flattenCards(lists), "due", "asc");
  assert.deepEqual(rows.map((r) => r.card.id), ["c", "a", "b"]);
});

test("sortRows by due date descending still puts undated cards last", () => {
  const rows = sortRows(flattenCards(lists), "due", "desc");
  assert.deepEqual(rows.map((r) => r.card.id), ["a", "c", "b"]);
});

test("sortRows by title respects direction", () => {
  const asc = sortRows(flattenCards(lists), "title", "asc");
  assert.deepEqual(asc.map((r) => r.card.id), ["b", "a", "c"]);
  const desc = sortRows(flattenCards(lists), "title", "desc");
  assert.deepEqual(desc.map((r) => r.card.id), ["c", "a", "b"]);
});

test("sortRows does not mutate its input array", () => {
  const original = flattenCards(lists);
  const originalOrder = original.map((r) => r.card.id);
  sortRows(original, "title", "desc");
  assert.deepEqual(original.map((r) => r.card.id), originalOrder);
});

test("buildMonthCells pads to a multiple of 7 and starts on the configured weekday", () => {
  const cells = buildMonthCells(2026, 11, 1);
  assert.equal(cells.length % 7, 0);
  const { from } = monthBounds(2026, 11);
  const expectedLead = (dayOfWeek(from) - 1 + 7) % 7;
  for (let i = 0; i < expectedLead; i++) assert.equal(cells[i], null);
  assert.equal(cells[expectedLead], from);
});

test("groupCardsByDate buckets dated cards by local-timezone date and keeps undated separately", () => {
  const rows = flattenCards(lists); // "a" due 2026-11-20, "b" undated, "c" due 2026-11-05
  const { byDate, undated } = groupCardsByDate(rows, "Asia/Ho_Chi_Minh");
  assert.equal(undated.length, 1);
  assert.equal(undated[0].card.id, "b");
  assert.equal(byDate["2026-11-20"]?.[0]?.card.id, "a");
  assert.equal(byDate["2026-11-05"]?.[0]?.card.id, "c");
});
