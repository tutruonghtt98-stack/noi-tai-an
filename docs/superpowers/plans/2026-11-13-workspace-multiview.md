# Workspace Multi-view (Phase 1: Bảng + Lịch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new ways to view an existing Workspace board — Bảng (table) and Lịch (calendar) — switchable via URL, rendering the exact same card data the Kanban view already uses.

**Architecture:** `page.tsx` reads a new `v` searchParam, validates it with a pure helper, and conditionally renders `<KanbanBoard>` (unchanged) or one of two new client components (`WorkTableView`, `WorkCalendarView`) fed the identical `SerializedList[]` already fetched. Both new views reuse `CardModal` for editing, via the same `openId` pattern `KanbanBoard` already uses. Row/cell flattening, sorting, and calendar-grid math live in a new pure lib module so they're unit-testable without a component-testing harness (none exists in this repo).

**Tech Stack:** Next.js App Router (Server + Client Components), TypeScript, existing `.card`/`.segmented` CSS utilities, `tsx --test` (Node's native test runner) for unit tests, Playwright MCP for manual UI verification (no RTL/component-test harness in this repo).

**Spec:** `docs/superpowers/specs/2026-11-13-workspace-multiview-design.md`

## Global Constraints

- Do not change `kanban-board.tsx` behavior, `card-modal.tsx`, `board-switcher.tsx`, the Prisma schema, or any server action in `src/actions/work.ts`. The only touch to `kanban-board.tsx` is adding one `export` keyword (Task 4) — no behavior change.
- Reuse the exact data already fetched by `getAccessibleBoards` in `page.tsx` — no new queries.
- Reuse `CardModal`, `CardBody`/`dueLabel` conventions from `kanban-board.tsx` so Bảng/Lịch display the same labels, due text, and checklist % as Kanban.
- All UI copy goes through `useI18n()`/`getI18n()` — no hardcoded strings (vi.ts canonical, en.ts mirrors).
- Default view stays Kanban when `v` is missing or invalid; Kanban must keep working unchanged.
- `ViewSwitcher` must not render when there is no active board (0 boards) — matches the empty-state branch in `page.tsx`.
- Clicking a card in Table or Calendar must open the real `CardModal` with full edit capability (same props as Kanban wires it), not a stripped-down view.

## Review Focus

- `?v=` holds garbage or an old value (`?v=xyz`, `?v=`) → must silently fall back to Kanban, never crash or render a blank view.
- A card has no `dueDate` and the table is sorted by due date (either direction) → it must still appear, sorted to the end, not thrown away or cause a NaN-comparison crash.
- A card has no `dueDate` in the Calendar view → it must appear in the "Chưa có hạn" strip, never silently disappear.
- Board has 0 boards (`active` is `undefined`) → `ViewSwitcher` must not render and `page.tsx` must not read `sp.v` into a view that has no data to show.
- Clicking a row/cell card in Table or Calendar opens `CardModal` wired with the same `teams`/`members`/`reviewListId`/`doneListId`/`canDelete` as Kanban — not a read-only or partially-wired modal.

---

## File Structure

- Create `src/lib/work-view.ts` — pure, framework-free helpers: view-param parsing, card flattening, sorting, month-grid cells, due-date grouping.
- Create `src/lib/work-view.test.ts` — unit tests for the above.
- Modify `src/lib/i18n/vi.ts` and `src/lib/i18n/en.ts` — add view-switcher and table/calendar copy under `work.workspace`.
- Modify `src/app/(app)/workspace/kanban-board.tsx` — export the existing `DOT` color map (one-line change) so Table/Calendar can reuse it.
- Create `src/app/(app)/workspace/view-switcher.tsx` — server-safe segmented control (plain `<Link>`s, no client JS needed).
- Create `src/app/(app)/workspace/work-table-view.tsx` — client component, spreadsheet-style row-per-card view.
- Create `src/app/(app)/workspace/work-calendar-view.tsx` — client component, month-grid view.
- Modify `src/app/(app)/workspace/page.tsx` — read/validate `v`, render `ViewSwitcher`, conditionally render the active view.

---

### Task 1: Pure view-state & data-shaping helpers

**Files:**
- Create: `src/lib/work-view.ts`
- Test: `src/lib/work-view.test.ts`

**Interfaces:**
- Consumes: `ISODate`, `monthBounds`, `rangeISO`, `dayOfWeek`, `isoInZone` from `src/lib/dates.ts` (all already exported, unchanged).
- Produces (used by Tasks 3-5):
  - `type WorkView = "kanban" | "table" | "calendar"`
  - `parseWorkView(v: string | undefined): WorkView`
  - `type FlattenableList<TCard> = { id: string; name: string; color: string; cards: TCard[] }`
  - `type FlatRow<TCard> = { listId: string; listName: string; listColor: string; card: TCard }`
  - `flattenCards<TCard>(lists: FlattenableList<TCard>[]): FlatRow<TCard>[]`
  - `type SortColumn = "title" | "due"`
  - `type SortDir = "asc" | "desc"`
  - `sortRows<TCard extends { title: string; dueDate: string | null }>(rows: FlatRow<TCard>[], column: SortColumn, dir: SortDir): FlatRow<TCard>[]` — new array, does not mutate input.
  - `buildMonthCells(year: number, month: number, weekStartsOn: number): (ISODate | null)[]`
  - `groupCardsByDate<TCard extends { dueDate: string | null }>(rows: FlatRow<TCard>[], timezone: string): { byDate: Record<ISODate, FlatRow<TCard>[]>; undated: FlatRow<TCard>[] }`

- [ ] **Step 1: Write failing tests for `parseWorkView`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
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
```

- [ ] **Step 2: Run tests, verify they fail with "Cannot find module"**

Run: `npm test`
Expected: FAIL — `work-view.ts` does not exist yet.

- [ ] **Step 3: Implement `parseWorkView` and the `WorkView` type in `src/lib/work-view.ts`**

Exact signature as in Interfaces. `WORK_VIEWS` constant list, `.includes` check, fallback `"kanban"`.

- [ ] **Step 4: Write failing tests for `flattenCards` and `sortRows`**

```ts
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
```

- [ ] **Step 5: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `flattenCards`/`sortRows` not defined.

- [ ] **Step 6: Implement `flattenCards` and `sortRows` in `src/lib/work-view.ts`**

`flattenCards`: `lists.flatMap((l) => l.cards.map((card) => ({ listId: l.id, listName: l.name, listColor: l.color, card })))`.
`sortRows`: copy the array first (`[...rows]`). For `column === "due"`: partition into dated/undated, sort dated by `Date.parse(dueDate)` with `dir` applied, concatenate `[...dated, ...undated]` (undated always last). For `column === "title"`: `localeCompare`, with `dir === "desc"` reversing the comparison result.

- [ ] **Step 7: Run tests, verify they pass**

Run: `npm test`
Expected: PASS for all tests added so far.

- [ ] **Step 8: Write failing tests for `buildMonthCells` and `groupCardsByDate`**

```ts
import { dayOfWeek, monthBounds } from "./dates";

test("buildMonthCells pads to a multiple of 7 and starts on the configured weekday", () => {
  const cells = buildMonthCells(2026, 11, 1);
  assert.equal(cells.length % 7, 0);
  const { from } = monthBounds(2026, 11);
  const expectedLead = (dayOfWeek(from) - 1 + 7) % 7;
  for (let i = 0; i < expectedLead; i++) assert.equal(cells[i], null);
  assert.equal(cells[expectedLead], from);
});

test("groupCardsByDate buckets dated cards by local-timezone date and keeps undated separately", () => {
  const rows = flattenCards(lists); // from Step 4's fixture: "a" due 2026-11-20, "b" undated, "c" due 2026-11-05
  const { byDate, undated } = groupCardsByDate(rows, "Asia/Ho_Chi_Minh");
  assert.equal(undated.length, 1);
  assert.equal(undated[0].card.id, "b");
  assert.equal(byDate["2026-11-20"]?.[0]?.card.id, "a");
  assert.equal(byDate["2026-11-05"]?.[0]?.card.id, "c");
});
```

- [ ] **Step 9: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `buildMonthCells`/`groupCardsByDate` not defined.

- [ ] **Step 10: Implement `buildMonthCells` and `groupCardsByDate` in `src/lib/work-view.ts`**

`buildMonthCells`: same approach as `DisciplineCalendar` in `src/components/dashboard.tsx` — `monthBounds` + `rangeISO` + `dayOfWeek`-based lead padding, then pad the end to a multiple of 7. Do not import `DisciplineCalendar` itself; this is an independent small implementation per the design doc.
`groupCardsByDate`: for each row, if `card.dueDate` is null push to `undated`; else bucket by `isoInZone(new Date(card.dueDate), timezone)` into `byDate`.

- [ ] **Step 11: Run tests, verify they pass**

Run: `npm test`
Expected: PASS for all tests in `work-view.test.ts`.

- [ ] **Step 12: Commit**

```bash
git add src/lib/work-view.ts src/lib/work-view.test.ts
git commit -m "feat(workspace): add pure view/sort/calendar-grid helpers for multi-view"
```

---

### Task 2: i18n copy for the new views

**Files:**
- Modify: `src/lib/i18n/vi.ts` (inside the existing `workspace: { ... }` block, after `listOverdue`, around line 529)
- Modify: `src/lib/i18n/en.ts` (mirror, same key names)

**Interfaces:**
- Produces: new keys under `t.work.workspace` consumed by Tasks 3-5: `viewKanban`, `viewTable`, `viewCalendar`, `colTitle`, `colStatus`, `colAssignee`, `colDue`, `colChecklist`, `calendarUndated`, `calendarPrevMonth`, `calendarNextMonth`.

- [ ] **Step 1: Add the keys to `vi.ts`**

```ts
viewKanban: "Kanban",
viewTable: "Bảng",
viewCalendar: "Lịch",
colTitle: "Tiêu đề",
colStatus: "Trạng thái",
colAssignee: "Phụ trách",
colDue: "Hạn chót",
colChecklist: "Việc cần làm",
calendarUndated: "Chưa có hạn",
calendarPrevMonth: "Tháng trước",
calendarNextMonth: "Tháng sau",
```

- [ ] **Step 2: Add the same keys (English values) to `en.ts`**

```ts
viewKanban: "Kanban",
viewTable: "Table",
viewCalendar: "Calendar",
colTitle: "Title",
colStatus: "Status",
colAssignee: "Assignee",
colDue: "Due date",
colChecklist: "Checklist",
calendarUndated: "No due date",
calendarPrevMonth: "Previous month",
calendarNextMonth: "Next month",
```

- [ ] **Step 3: Verify both dictionaries still type-check against each other**

Run: `npx tsc --noEmit`
Expected: PASS — `Dict = typeof vi` and `en.ts` must structurally match it; a missing/extra key in either file fails this.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "feat(workspace): add i18n copy for view switcher, table and calendar views"
```

---

### Task 3: View switcher component

**Files:**
- Create: `src/app/(app)/workspace/view-switcher.tsx`

**Interfaces:**
- Consumes: `WorkView` type from `src/lib/work-view.ts` (Task 1); `Dict["work"]["workspace"]` shape from `src/lib/i18n/vi.ts` with the new keys from Task 2.
- Produces: `ViewSwitcher({ w, boardId, current }: { w: Dict["work"]["workspace"]; boardId?: string; current: WorkView }): JSX.Element` — consumed by `page.tsx` in Task 6.

- [ ] **Step 1: Implement `ViewSwitcher`**

No "use client" needed — plain `<Link>`s read by the server. Use the existing `.segmented` CSS class (see `src/app/globals.css:438`), one `<Link>` per view (`kanban`/`table`/`calendar`), `href` = `` `/workspace?${boardId ? `b=${encodeURIComponent(boardId)}&` : ""}v=${key}` ``, `aria-current="page"` when `key === current` (matches the `.segmented > a[aria-current="page"]` CSS rule already in place). Labels: `w.viewKanban`/`w.viewTable`/`w.viewCalendar`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/workspace/view-switcher.tsx
git commit -m "feat(workspace): add view switcher component"
```

---

### Task 4: Table view

**Files:**
- Create: `src/app/(app)/workspace/work-table-view.tsx`
- Modify: `src/app/(app)/workspace/kanban-board.tsx:20` — change `const DOT: Record<string, string> = {...}` to `export const DOT: Record<string, string> = {...}` (no other change to this file; same object).

**Interfaces:**
- Consumes: `SerializedList`, `DOT`, `dueLabel` from `./kanban-board`; `CardModal`, `type SerializedCard` from `./card-modal`; `type MemberOption` from `./assignee-picker`; `flattenCards`, `sortRows`, `type SortColumn`, `type SortDir` from `@/lib/work-view`; `useI18n` from `@/lib/i18n/client`.
- Produces: `WorkTableView({ lists, canManage, teams, members, timezone }: { lists: SerializedList[]; canManage?: boolean; teams?: { id: string; name: string }[]; members?: MemberOption[]; timezone: string }): JSX.Element` — consumed by `page.tsx` in Task 6, same prop shape `KanbanBoard` takes minus `openCardId`.

- [ ] **Step 1: Export `DOT` from `kanban-board.tsx`**

One-word change at `kanban-board.tsx:20`: add `export` before `const DOT`. No other line in this file changes.

- [ ] **Step 2: Implement `WorkTableView`**

`"use client"`. State: `sortCol: SortColumn` (default `"due"`), `sortDir: SortDir` (default `"asc"`), `openCard: { card: SerializedCard; listId: string } | null` (default `null`). `const rows = sortRows(flattenCards(lists), sortCol, sortDir)`. Clicking a column header (Tiêu đề/Hạn chót) toggles `sortCol` to that column and flips `sortDir` if already sorting by it, else resets to `"asc"`. `listOptions` and `doneListId`/`reviewListId` computed the same way `KanbanBoard` computes them (`lists.find((l) => l.name === "listDone")?.id`, etc.) — needed so `CardModal` behaves identically. Render a `<table>`: columns Tiêu đề (label badge + title), Trạng thái (`<span className={DOT[row.listColor] ?? "bg-muted"} />` dot + `w[row.listName as keyof typeof w] ?? row.listName`), Phụ trách (`Avatar` if `card.assignee`, else "—"), Hạn chót (`dueLabel(w, card.dueDate, timezone) ?? w.noDue`), Việc cần làm (`${done}/${total}` from `card.checklist`). Row `onClick` sets `openCard`. Render `<CardModal open={!!openCard} card={openCard?.card ?? null} listId={openCard?.listId ?? ""} lists={listOptions} teams={teams} members={members} reviewListId={reviewListId} doneListId={doneListId} onClose={() => setOpenCard(null)} canDelete={canManage} timezone={timezone} />` — same wiring as `KanbanBoard`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/workspace/kanban-board.tsx src/app/\(app\)/workspace/work-table-view.tsx
git commit -m "feat(workspace): add table view, reusing Kanban's card data and CardModal"
```

---

### Task 5: Calendar view

**Files:**
- Create: `src/app/(app)/workspace/work-calendar-view.tsx`

**Interfaces:**
- Consumes: `SerializedList` from `./kanban-board`; `CardModal`, `type SerializedCard` from `./card-modal`; `type MemberOption` from `./assignee-picker`; `flattenCards`, `groupCardsByDate`, `buildMonthCells` from `@/lib/work-view`; `type ISODate` from `@/lib/dates`; `useI18n` from `@/lib/i18n/client`.
- Produces: `WorkCalendarView({ lists, canManage, teams, members, timezone, today, weekStartsOn }: { lists: SerializedList[]; canManage?: boolean; teams?: { id: string; name: string }[]; members?: MemberOption[]; timezone: string; today: ISODate; weekStartsOn: number }): JSX.Element` — consumed by `page.tsx` in Task 6.

- [ ] **Step 1: Implement `WorkCalendarView`**

`"use client"`. State: `monthOffset: number` (default `0`, changed by prev/next buttons via `setMonthOffset((n) => n - 1 | n + 1)`). Derive the viewed year/month from `today` and `monthOffset` with UTC-safe math: `const [y0, m0] = today.split("-").map(Number); const d = new Date(Date.UTC(y0, m0 - 1 + monthOffset, 1)); const year = d.getUTCFullYear(); const month = d.getUTCMonth() + 1;`. `const cells = buildMonthCells(year, month, weekStartsOn)`. `const { byDate, undated } = groupCardsByDate(flattenCards(lists), timezone)`. Title: `new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)))` (same pattern as `DisciplineCalendar`, `locale` from `useI18n()`). Weekday header row: `t.habits.weekdays[(i + weekStartsOn) % 7]` for `i` in `0..6` (same reuse `DisciplineCalendar` makes of this array). Grid: one cell per entry in `cells`; `null` entries render an empty placeholder; date entries render the day number plus up to a few card title chips from `byDate[iso]` (each chip `onClick` opens that card). Above the grid, an "undated" strip renders `undated` as chips when non-empty, labelled `w.calendarUndated`. Clicking any chip sets `openCard: { card, listId }` (same shape as Task 4) and renders `<CardModal>` wired identically to Task 4's (same `lists`/`teams`/`members`/`reviewListId`/`doneListId`/`canDelete`/`timezone`, computed the same way).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/workspace/work-calendar-view.tsx
git commit -m "feat(workspace): add calendar view, grouping existing cards by due date"
```

---

### Task 6: Wire views into the Workspace page + manual verification

**Files:**
- Modify: `src/app/(app)/workspace/page.tsx`

**Interfaces:**
- Consumes: `parseWorkView` from `@/lib/work-view`; `ViewSwitcher` from `./view-switcher`; `WorkTableView` from `./work-table-view`; `WorkCalendarView` from `./work-calendar-view`; `user.weekStartsOn` (already available on the `user` object returned by `requireUser()`, used elsewhere in the codebase, e.g. `src/app/(app)/dashboard/page.tsx:50`).

- [ ] **Step 1: Add `v` to the `searchParams` type and parse it**

`searchParams: Promise<{ b?: string; card?: string; v?: string }>`. After `const sp = await searchParams;`, add `const view = parseWorkView(sp.v);`.

- [ ] **Step 2: Render `ViewSwitcher` only when a board is active**

Inside the `!active ? (...) : (...)` branch's `else` arm, before `<KanbanBoard .../>`, add `<ViewSwitcher w={w} boardId={active.id} current={view} />`. Do not render it in the `!active` (empty-state) arm.

- [ ] **Step 3: Conditionally render the active view**

Replace the single `<KanbanBoard ... />` call with: build the `SerializedList[]` mapping exactly as today (unchanged), store it in a `lists` local, then:
```tsx
{view === "kanban" ? (
  <KanbanBoard lists={lists} canManage={active.access === "owner"} teams={teamOptions} members={members} openCardId={sp.card} timezone={user.timezone} />
) : view === "table" ? (
  <WorkTableView lists={lists} canManage={active.access === "owner"} teams={teamOptions} members={members} timezone={user.timezone} />
) : (
  <WorkCalendarView lists={lists} canManage={active.access === "owner"} teams={teamOptions} members={members} timezone={user.timezone} today={today} weekStartsOn={user.weekStartsOn} />
)}
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both PASS.

- [ ] **Step 5: Manual Playwright verification (golden path + edge cases)**

Start the dev server logging to a file outside the repo (e.g. `/tmp/workspace-dev.log`), then with Playwright against a real board with a mix of cards (some with `dueDate`, at least one without):
1. `/workspace` loads straight into Kanban (no `?v=`) — unchanged from before.
2. Click "Bảng" — table renders all cards across lists; click a row — `CardModal` opens and an edit (e.g. title) saves successfully.
3. Sort by Hạn chót asc/desc — card(s) without a due date stay at the end in both directions.
4. Click "Lịch" — cards with a due date appear on the right day cell; the undated card appears in the "Chưa có hạn" strip; click a card chip — `CardModal` opens and works.
5. Prev/next month buttons move the grid without a network request (devtools network tab stays quiet).
6. Manually visit `/workspace?v=xyz` — page falls back to Kanban, no crash.
7. A user/account with 0 boards — confirm `ViewSwitcher` does not render in the empty state.

Record pass/fail for each; fix forward before moving on.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/workspace/page.tsx
git commit -m "feat(workspace): wire Table and Calendar views into the Workspace page"
```
