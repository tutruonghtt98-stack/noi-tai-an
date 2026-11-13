# Workspace — Pooled Boards, List View, Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the per-board tab row from Workspace (pool every accessible board's cards into one view), drop Kanban from the view switcher in favor of a new reference-styled "List" view, and add a fixed-choice `priority` field to cards.

**Architecture:** Pooling is pure-function grouping (no schema change, no new query): `page.tsx` already fetches all accessible boards via `getAccessibleBoards`; a new pure helper in `src/lib/work-view.ts` merges each board's same-named lists (`listToDo`, `listInProgress`, ...) into one set of 5 pooled groups, unit-tested without a database. Because pooling hides which board a card came from, every `SerializedCard` carries its own real `boardId` and real `listId` so `CardModal` can still write to the correct underlying `WorkList`/`WorkBoard` — this is the plan's one genuinely tricky piece, resolved below exactly, not left to the implementer to improvise.

**Tech Stack:** Next.js Server Components, Prisma/Postgres (one additive enum + column), Zod, `tsx --test` for the new pure pooling/view-param logic, Playwright MCP for manual UI verification (no component-test harness in this repo).

**Spec:** `docs/superpowers/specs/2026-11-13-workspace-pooled-list-design.md`

## Global Constraints

- Do not touch `assigneeUserId`, permission checks (`canActOnCard`/`isBoardOwner`), discipline scoring, Journey achievement sync, or `WorkCardEvent` — multi-assignee permissions is a separate future phase, explicitly out of scope.
- Do not change `AssigneePicker` — one person via email, exactly as today.
- `WorkBoard`/`WorkList` schema and `getAccessibleBoards` stay unchanged — pooling is a pure in-memory merge of already-fetched data, not a query or schema change.
- Do not delete `kanban-board.tsx`'s component or drag-and-drop logic — it simply stops being imported/rendered from `page.tsx`. Its small exported utilities (`DOT`, `dueLabel`, `SerializedList`) keep being imported by the new List view and by Calendar, unchanged.
- No new field for card "description" and no "mark done" checkbox in the new List view — not requested, would create a second, unreviewed path to completion alongside the existing Xem lại → duyệt flow.
- Any `npx prisma db push` against the shared dev/prod database requires explicit confirmation from the human partner before running it — the task that needs it says so explicitly.

## Review Focus

- A user with 2+ boards, each owned/shared differently (owner on one, team-granted on another): opening a card from the pooled List/Calendar view and changing its column, priority, or deleting it must write to that card's *own* board's real `WorkList`, never another board's, and must respect that specific board's owner/member permission (not a blanket pooled-view permission).
- A user with exactly 1 board: the new "+ Thêm việc" button must not show a board picker (per spec, hidden when `boards.length <= 1`), and must still create the card in the right list.
- A card whose board is NOT owned by the current user, sitting in the "Hoàn thành" (Done) pooled group: opening it must still show it locked (read-only, no approve/delete) exactly as it does today in Kanban/Table — pooling must not accidentally use the *wrong* board's done/review list id when computing the lock, which would silently unlock a card that should stay locked (or vice versa, lock one that shouldn't be).
- `?v=kanban` or `?v=table` (old/bookmarked links) after this change must fall back to the new default (`list`), never crash or render a blank page.
- A deep-link that opens a specific card (`/workspace?b=...&card=<id>` — built today by a comment notification, the Dashboard's upcoming-schedule widget, and Journey's workspace-tasks link) must still open that exact card's panel on arrival, not just land on the pooled List view with nothing auto-opened.
- A card created via the new "+ Thêm việc" button must appear immediately in the pooled List view under the chosen status group, and (if the chosen board is the default single board) without requiring the user to pick anything they weren't shown.

---

## File Structure

- Modify `prisma/schema.prisma` — add `WorkCardPriority` enum + `WorkCard.priority`.
- Modify `src/actions/work.ts` — `cardSchema` gains `priority`; `createWorkCard`/`updateWorkCard` persist it.
- Modify `src/lib/work-view.ts` — `WorkView` becomes `"list" | "calendar"`; new pure `poolListsByName` helper.
- Modify `src/lib/work-view.test.ts` — update `parseWorkView` tests for the new value set/default; add `poolListsByName` tests.
- Modify `src/app/(app)/workspace/kanban-board.tsx` — export `WorkCardPriority` type + `PRIORITY_BADGE_CLASS` map (one-line-each additions, no behavior change to the component itself).
- Modify `src/app/(app)/workspace/card-modal.tsx` — `SerializedCard` gains `priority`, `boardId`, `listId`; add the Priority field to the panel.
- Create `src/app/(app)/workspace/new-task-button.tsx` — the "+ Thêm việc" page-level create button.
- Create `src/app/(app)/workspace/work-list-view.tsx` — replaces `work-table-view.tsx` (deleted in the same task).
- Modify `src/app/(app)/workspace/work-calendar-view.tsx` — accept pooled data correctly (per-card real ids for `CardModal`, `canManageByBoardId` instead of one `canManage` flag).
- Modify `src/app/(app)/workspace/view-switcher.tsx` — drop Kanban, rename Table → List, drop the now-unused `boardId` prop.
- Modify `src/lib/i18n/vi.ts` and `src/lib/i18n/en.ts` — new copy (Priority, new-task form, List view).
- Modify `src/app/(app)/workspace/page.tsx` — remove `BoardSwitcher`/`BoardHeaderCard`, pool lists, build `boardListsByBoardId`/`canManageByBoardId`, wire `NewTaskButton`/`WorkListView`/`WorkCalendarView`.

---

### Task 1: Schema — `WorkCardPriority`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces (used by Task 2): `enum WorkCardPriority { LOW NORMAL URGENT }`, `WorkCard.priority: WorkCardPriority` with `@default(NORMAL)`.

- [ ] **Step 1: Add the enum and field**

Add, near the other enums at the top of the file:
```prisma
enum WorkCardPriority {
  LOW
  NORMAL
  URGENT
}
```
Add `priority WorkCardPriority @default(NORMAL)` to the `WorkCard` model, next to `startDate`.

- [ ] **Step 2: Validate**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 3: Stop and confirm before touching the shared database**

Ask your human partner to confirm before running `npx prisma db push` — standing project rule, every time.

- [ ] **Step 4: Push and regenerate**

Run: `npx prisma db push`
Run: `npx prisma generate`
Expected: both complete without errors. Existing cards get `NORMAL` automatically (the `@default`).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(workspace): add WorkCardPriority enum and WorkCard.priority"
```

---

### Task 2: Pure pooling helper + `WorkView` value set

**Files:**
- Modify: `src/lib/work-view.ts`
- Modify: `src/lib/work-view.test.ts`

**Interfaces:**
- Produces (used by Task 8 / page.tsx):
  - `WorkView = "list" | "calendar"` (was `"kanban" | "table" | "calendar"`); `parseWorkView` now defaults to `"list"` for anything not in `["list", "calendar"]`.
  - `type PoolableList<TCard> = { name: string; color: string; cards: TCard[] }`
  - `poolListsByName<TCard>(boardsLists: PoolableList<TCard>[][], order: { name: string; color: string }[]): PoolableList<TCard>[]` — for each `{name, color}` in `order`, concatenates the `cards` of every board's list with that `name` (missing lists treated as empty), in `order`'s own sequence. Pure, no DB.

- [ ] **Step 1: Update the existing `parseWorkView` tests for the new value set**

Replace the two existing tests in `work-view.test.ts`:
```ts
test("parseWorkView returns the value when valid", () => {
  assert.equal(parseWorkView("list"), "list");
  assert.equal(parseWorkView("calendar"), "calendar");
});

test("parseWorkView defaults to list for missing or invalid values", () => {
  assert.equal(parseWorkView(undefined), "list");
  assert.equal(parseWorkView(""), "list");
  assert.equal(parseWorkView("kanban"), "list");
  assert.equal(parseWorkView("table"), "list");
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `parseWorkView` still returns `"kanban"` for invalid input, and `"table"`/`"kanban"` are still accepted as valid.

- [ ] **Step 3: Update `WorkView`/`WORK_VIEWS`/`parseWorkView` in `work-view.ts`**

```ts
export type WorkView = "list" | "calendar";
const WORK_VIEWS: WorkView[] = ["list", "calendar"];

export function parseWorkView(v: string | undefined): WorkView {
  return (WORK_VIEWS as string[]).includes(v ?? "") ? (v as WorkView) : "list";
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write failing tests for `poolListsByName`**

```ts
type TestCard = { id: string };
const order = [
  { name: "listToDo", color: "muted" },
  { name: "listDone", color: "jade" },
];

test("poolListsByName merges same-named lists across boards, in order's sequence", () => {
  const boardA = [{ name: "listToDo", color: "muted", cards: [{ id: "a1" }] }];
  const boardB = [
    { name: "listToDo", color: "muted", cards: [{ id: "b1" }] },
    { name: "listDone", color: "jade", cards: [{ id: "b2" }] },
  ];
  const pooled = poolListsByName<TestCard>([boardA, boardB], order);
  assert.deepEqual(pooled.map((l) => l.name), ["listToDo", "listDone"]);
  assert.deepEqual(pooled[0]!.cards.map((c) => c.id), ["a1", "b1"]);
  assert.deepEqual(pooled[1]!.cards.map((c) => c.id), ["b2"]);
});

test("poolListsByName treats a board missing a named list as contributing no cards for it", () => {
  const boardWithoutDone = [{ name: "listToDo", color: "muted", cards: [{ id: "x" }] }];
  const pooled = poolListsByName<TestCard>([boardWithoutDone], order);
  assert.deepEqual(pooled[1]!.cards, []);
});
```

- [ ] **Step 6: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `poolListsByName` not defined.

- [ ] **Step 7: Implement `poolListsByName` in `work-view.ts`**

```ts
export type PoolableList<TCard> = { name: string; color: string; cards: TCard[] };

export function poolListsByName<TCard>(
  boardsLists: PoolableList<TCard>[][],
  order: { name: string; color: string }[],
): PoolableList<TCard>[] {
  return order.map(({ name, color }) => ({
    name,
    color,
    cards: boardsLists.flatMap((lists) => lists.find((l) => l.name === name)?.cards ?? []),
  }));
}
```

- [ ] **Step 8: Run tests, verify they pass**

Run: `npm test`
Expected: PASS, full suite (not just the new tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/work-view.ts src/lib/work-view.test.ts
git commit -m "feat(workspace): pool same-named lists across boards; drop kanban/table from WorkView"
```

---

### Task 3: Priority badge metadata + i18n copy

**Files:**
- Modify: `src/app/(app)/workspace/kanban-board.tsx` (export additions only, near the existing `DOT` export)
- Modify: `src/lib/i18n/vi.ts` and `src/lib/i18n/en.ts`

**Interfaces:**
- Produces (used by Tasks 5, 6, 8):
  - `export type WorkCardPriority = "LOW" | "NORMAL" | "URGENT";`
  - `export const PRIORITY_BADGE_CLASS: Record<WorkCardPriority, string>`
  - New `t.work.workspace` keys: `priorityTitle`, `priorityLow`, `priorityNormal`, `priorityUrgent`, `colPriority`, `viewList`, `newTask`, `newTaskTitle`, `newTaskBoardLabel`.
  - Removed `t.work.workspace` keys (now unused): `viewKanban`, `viewTable`, `colStatus`, `colChecklist` (List view has no Status column — it's the group header — and no checklist-progress column per the design).

- [ ] **Step 1: Add `WorkCardPriority` and `PRIORITY_BADGE_CLASS` to `kanban-board.tsx`**

Right after the existing `export const DOT = ...` line:
```ts
export type WorkCardPriority = "LOW" | "NORMAL" | "URGENT";
export const PRIORITY_BADGE_CLASS: Record<WorkCardPriority, string> = {
  LOW: "bg-jade/15 text-jade-ink",
  NORMAL: "bg-ochre/15 text-ochre-ink",
  URGENT: "bg-danger/15 text-danger",
};
```

- [ ] **Step 2: Add the new keys to `vi.ts`**

```ts
priorityTitle: "Mức độ ưu tiên",
priorityLow: "Thấp",
priorityNormal: "Bình thường",
priorityUrgent: "Khẩn cấp",
colPriority: "Mức độ",
viewList: "List",
newTask: "+ Thêm việc",
newTaskTitle: "Thêm việc mới",
newTaskBoardLabel: "Bảng",
```
Remove `viewKanban`, `viewTable`, `colStatus`, `colChecklist`.

- [ ] **Step 3: Mirror in `en.ts`**

```ts
priorityTitle: "Priority",
priorityLow: "Low",
priorityNormal: "Normal",
priorityUrgent: "Urgent",
colPriority: "Priority",
viewList: "List",
newTask: "+ New task",
newTaskTitle: "New task",
newTaskBoardLabel: "Board",
```
Remove the same 4 keys as Step 2.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: FAIL at this point — `view-switcher.tsx`, `work-table-view.tsx` still reference the removed keys (`viewKanban`/`viewTable`/`colStatus`/`colChecklist`). This is expected; Tasks 4 and 6 fix these call sites. Confirm the errors are *only* in those two files (not elsewhere) before moving on — if anything else references the removed keys, that is new information the plan did not anticipate: ledger it and fix forward.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/workspace/kanban-board.tsx" src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "feat(workspace): add Priority badge metadata and i18n copy for List view and new-task button"
```

---

### Task 4: `ViewSwitcher` — drop Kanban, rename Table to List

**Files:**
- Modify: `src/app/(app)/workspace/view-switcher.tsx`

**Interfaces:**
- Consumes: `WorkView` (now `"list" | "calendar"`) from Task 2; `w.viewList`/`w.viewCalendar` from Task 3.
- Produces: `ViewSwitcher({ w, current }: { w: Dict["work"]["workspace"]; current: WorkView })` — **`boardId` prop removed** (no more `?b=` to preserve; pooling means there is no "active board" to carry across a view switch).

- [ ] **Step 1: Rewrite the component**

```tsx
export function ViewSwitcher({ w, current }: { w: Dict["work"]["workspace"]; current: WorkView }) {
  const views: { key: WorkView; label: string }[] = [
    { key: "list", label: w.viewList },
    { key: "calendar", label: w.viewCalendar },
  ];
  return (
    <div className="wsx-tabs">
      {views.map((v) => (
        <Link key={v.key} href={`/workspace?v=${v.key}`} aria-current={v.key === current ? "page" : undefined}>
          {v.label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: the `view-switcher.tsx` errors from Task 3 Step 4 are gone; remaining errors (if any) are only in files Task 6/8 haven't touched yet.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/workspace/view-switcher.tsx"
git commit -m "feat(workspace): drop Kanban and rename Table to List in the view switcher"
```

---

### Task 5: `card-modal.tsx` — add Priority, and the `boardId`/real-`listId` fields

**Files:**
- Modify: `src/app/(app)/workspace/card-modal.tsx`

**Interfaces:**
- Consumes: `WorkCardPriority`, `PRIORITY_BADGE_CLASS` from Task 3; `w.priorityTitle`/`w.priorityLow`/`w.priorityNormal`/`w.priorityUrgent` from Task 3.
- Produces: `SerializedCard` gains `priority: WorkCardPriority`, `boardId: string` (real `WorkBoard.id` this card belongs to), and keeps its existing `id`/`label`/`title`/... — **note:** the component's own `listId` *prop* (passed by the caller, used to initialize the `column` state) already carries whatever id the caller passes; this task does not change that prop's meaning, it only adds `boardId` to the card payload itself so Tasks 6-8's callers have something to look up the *right* `lists`/`reviewListId`/`doneListId` values per card before rendering `CardModal`.

- [ ] **Step 1: Add `priority` and `boardId` to `SerializedCard`**

```ts
export type SerializedCard = {
  id: string;
  boardId: string;
  listId: string;
  label: string | null;
  title: string;
  assignee: string | null;
  teamId: string | null;
  dueDate: string | null;
  startDate: string | null;
  priority: WorkCardPriority;
  checklist: ChecklistItem[];
};
```
`listId` here is the card's own real `WorkList.id` (distinct from the `listId` *prop* `CardModal` already takes — that prop still just initializes the `column` state as today; this new field on the card itself is what callers in Tasks 6-7 read to look up the right `lists`/`reviewListId`/`doneListId` before rendering `CardModal`). Import `WorkCardPriority`, `PRIORITY_BADGE_CLASS` from `./kanban-board`.

- [ ] **Step 2: Add `priority` state and wiring**

- `const [priority, setPriority] = useState<WorkCardPriority>("NORMAL");`
- In the card-load `useEffect`, add `setPriority(card.priority);`.
- In `saveInfo()`, add `priority` to the `updateWorkCard` payload: `priority,` (no `|| undefined` — always one of the 3 fixed values).

- [ ] **Step 3: Render the Priority field**

Change the existing Cột/Loại row from `grid min-w-0 gap-4 sm:grid-cols-2` to `sm:grid-cols-3`, and add a third `<label className="field">` after the Loại field:
```tsx
<label className="field">
  <span className="label">{w.priorityTitle}</span>
  <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as WorkCardPriority)} disabled={locked}>
    <option value="LOW">{w.priorityLow}</option>
    <option value="NORMAL">{w.priorityNormal}</option>
    <option value="URGENT">{w.priorityUrgent}</option>
  </select>
</label>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: FAIL — every caller of `<CardModal card={...}>` now needs `priority`/`boardId` on the `card` object it builds (Tasks 6-8 are the callers; this is expected and fixed there). Confirm the only new errors are "Property 'priority'/'boardId' is missing" in `work-table-view.tsx` (deleted in Task 6), `work-calendar-view.tsx` (Task 7), and `page.tsx` (Task 8).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/workspace/card-modal.tsx"
git commit -m "feat(workspace): add Priority field and boardId to the card detail panel"
```

---

### Task 6: `work-list-view.tsx` (new, replaces `work-table-view.tsx`)

**Files:**
- Create: `src/app/(app)/workspace/work-list-view.tsx`
- Delete: `src/app/(app)/workspace/work-table-view.tsx`

**Interfaces:**
- Consumes: `DOT`, `dueLabel`, `type SerializedList` from `./kanban-board` (unchanged); `PRIORITY_BADGE_CLASS` from Task 3; `CardModal`, `type SerializedCard` from `./card-modal` (now requires `priority`/`boardId`/`listId` per Task 5); `flattenCards` from `@/lib/work-view`; `w.colTitle`/`w.colAssignee`/`w.typeTitle`/`w.timelineTitle`/`w.colPriority`/`w.priorityLow`/`w.priorityNormal`/`w.priorityUrgent` from Task 3/existing; `useRouter` from `next/navigation`.
- Produces: `WorkListView({ lists, boardListsByBoardId, canManageByBoardId, teams, members, timezone, openCardId }: { lists: SerializedList[]; boardListsByBoardId: Record<string, { id: string; name: string }[]>; canManageByBoardId: Record<string, boolean>; teams?: { id: string; name: string }[]; members?: MemberOption[]; timezone: string; openCardId?: string }): JSX.Element` — consumed by Task 8 / `page.tsx`. **No `canManage` top-level prop** (replaced by the per-board map — this is the fix for Review Focus item 1/3). `openCardId` keeps the existing "open a specific card from a notification/dashboard/journey deep-link" behavior working post-pooling (see Step 1a) — **required**, not optional to implement: `src/actions/work.ts:576`, `src/app/(app)/dashboard/page.tsx:77`, and `src/app/(app)/journey/page.tsx:252` all build `/workspace?...&card=<id>` links today and must keep working.

- [ ] **Step 1a: Keep deep-links (`?card=<id>`) working**

Copy `kanban-board.tsx`'s existing `openCardId` auto-open effect (its lines ~85-98) verbatim in shape, with one change — use the card's own real `listId` field instead of the containing list's id:
```ts
useEffect(() => {
  if (!openCardId) return;
  for (const list of lists) {
    const card = list.cards.find((c) => c.id === openCardId);
    if (card) {
      setOpenCard({ card, listId: card.listId });
      break;
    }
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("card");
  router.replace(url.pathname + url.search, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [openCardId]);
```

- [ ] **Step 1: Implement `WorkListView`**

`"use client"`. State: `collapsed: Record<string, boolean>` (keyed by `list.name`, default all expanded i.e. absent from the record means expanded); `openCard: { card: SerializedCard; listId: string } | null`.

For each `list` in `lists` (already pooled, in `DEFAULT_LISTS` order — the caller guarantees this): render a group:
```tsx
<div key={list.name} className="wsx-panel mb-4">
  <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setCollapsed((c) => ({ ...c, [list.name]: !c[list.name] }))}>
    <span className={`size-2 shrink-0 rounded-full ${DOT[list.color] ?? "bg-muted"}`} aria-hidden />
    <span className="font-medium">{w[list.name as keyof typeof w] ?? list.name}</span>
    <span className="tabular text-muted">({list.cards.length})</span>
    {collapsed[list.name] ? <ChevronRight className="size-4 ml-auto" aria-hidden /> : <ChevronDown className="size-4 ml-auto" aria-hidden />}
  </button>
  {!collapsed[list.name] && list.cards.length > 0 && (
    <table className="mt-3 w-full text-left text-sm">
      {/* <thead>: colTitle, colAssignee, typeTitle (reused as "Type" column header), timelineTitle (reused as "Timeline" column header), colPriority */}
      {/* <tbody>: one row per card, same role="button"/tabIndex/onClick/onKeyDown pattern work-table-view.tsx already used for keyboard access */}
    </table>
  )}
  {list.cards.length === 0 && <p className="mt-3 text-sm text-muted">{w.emptyList}</p>}
</div>
```
Row cells: Tên việc (label badge + title, same markup `work-table-view.tsx` used), Người phụ trách (`Avatar` or `—`), Type (`card.label || "—"`), Thời gian (`dueLabel(w, card.dueDate, timezone) ?? w.noDue`), Priority (`<span className={cn("badge", PRIORITY_BADGE_CLASS[card.priority])}>{{LOW: w.priorityLow, NORMAL: w.priorityNormal, URGENT: w.priorityUrgent}[card.priority]}</span>`).

Row click: **use `flattenCards(lists)` is not needed here** (unlike the old sortable Table, List view doesn't flatten/sort across groups — it renders `list.cards` directly per group, preserving `DEFAULT_LISTS` order as the grouping itself). Opening a card:
```ts
const open = (card: SerializedCard) => setOpenCard({ card, listId: card.listId });
```
**Critical — this is the Review Focus item 1/3 fix:** `card.listId` here is the card's own real `WorkList.id` (`SerializedCard.listId`, added in Task 5) — never `list.id`/`list.name` (the pooled group, which has no real id).

When rendering `<CardModal>`:
```tsx
const boardLists = (openCard && boardListsByBoardId[openCard.card.boardId]) || [];
const doneListId = boardLists.find((l) => l.name === "listDone")?.id;
const reviewListId = boardLists.find((l) => l.name === "listReview")?.id;
const canDelete = openCard ? (canManageByBoardId[openCard.card.boardId] ?? false) : true;
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
```

- [ ] **Step 2: Delete `work-table-view.tsx`**

Run: `rm "src/app/(app)/workspace/work-table-view.tsx"` (or your OS's delete equivalent).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `work-list-view.tsx` or a missing `work-table-view.tsx` (nothing else imports the deleted file — confirm with a search before this step if unsure). Errors remaining in `page.tsx` (not yet wired, Task 8) are expected.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/workspace/work-list-view.tsx"
git rm "src/app/(app)/workspace/work-table-view.tsx"
git commit -m "feat(workspace): add grouped List view with Priority, replacing the plain Table view"
```

---

### Task 7: `work-calendar-view.tsx` — pooled-safe `CardModal` wiring

**Files:**
- Modify: `src/app/(app)/workspace/work-calendar-view.tsx`

**Interfaces:**
- Consumes: same `boardListsByBoardId`/`canManageByBoardId` shape as Task 6.
- Produces: `WorkCalendarView` signature drops `canManage` in favor of `boardListsByBoardId`/`canManageByBoardId` (same two new props as `WorkListView`), everything else (`lists`, `teams`, `members`, `timezone`, `today`, `weekStartsOn`) unchanged. `WorkCalendarView` did not previously take `openCardId` (Phase 1 never wired it, since Kanban already handled every deep-link at the time) — it still doesn't need to in this task: `page.tsx` (Task 8) only passes `openCardId` to whichever view is actually selected (`view === "list"`), and Calendar stays reachable only by clicking "Lịch" from inside the app, never as a deep-link target. If this assumption is wrong (a deep-link that opens specifically into Calendar), that is new information — ledger it and add the same effect Task 6 Step 1a uses.

- [ ] **Step 1: Replace the `canManage` prop with the two maps**

Remove `canManage = true` from the destructured props and its type; add `boardListsByBoardId: Record<string, { id: string; name: string }[]>` and `canManageByBoardId: Record<string, boolean>`.

- [ ] **Step 2: Fix the `CardModal` wiring at the bottom of the component**

Remove the existing `const listOptions = ...`, `const doneListId = ...`, `const reviewListId = ...` lines (they currently compute from the pooled `lists`, which is wrong post-pooling — same bug Task 6 fixes in List view). Replace with the identical per-card lookup Task 6 uses:
```ts
const boardLists = (openCard && boardListsByBoardId[openCard.card.boardId]) || [];
const doneListId = boardLists.find((l) => l.name === "listDone")?.id;
const reviewListId = boardLists.find((l) => l.name === "listReview")?.id;
const canDelete = openCard ? (canManageByBoardId[openCard.card.boardId] ?? false) : true;
```
Pass `lists={boardLists}` and `canDelete={canDelete}` to `<CardModal>` instead of the old `listOptions`/`canManage`.

Also fix the `chip` click handler the same way Task 6 does: `setOpenCard({ card, listId: row.card.listId })` instead of `setOpenCard({ card, listId: row.listId })` (`row.listId` is the pooled virtual id from `flattenCards`, never the real one).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `work-calendar-view.tsx`. Remaining errors in `page.tsx` are expected (Task 8).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/workspace/work-calendar-view.tsx"
git commit -m "fix(workspace): open CardModal with each card's own board's real list ids in Calendar view"
```

---

### Task 8: `new-task-button.tsx` + `page.tsx` wiring + manual verification

**Files:**
- Create: `src/app/(app)/workspace/new-task-button.tsx`
- Modify: `src/app/(app)/workspace/page.tsx`

**Interfaces:**
- Consumes: `createWorkCard` from `@/actions/work` (unchanged signature); `poolListsByName` from Task 2; `WorkListView` from Task 6; `WorkCalendarView` from Task 7; `ViewSwitcher` from Task 4; `DEFAULT_LISTS` from `@/lib/work-queries` (already exported, unchanged).
- Produces: `NewTaskButton({ boards, teams, members }: { boards: { id: string; name: string; lists: { id: string; name: string }[] }[]; teams?: { id: string; name: string }[]; members?: MemberOption[] }): JSX.Element`.

- [ ] **Step 1: Implement `NewTaskButton`**

Copy `AddCardButton`'s form fields/state (`label`, `title`, `assignee`, `teamId`, `dueDate`) and its `Modal`-based open/close pattern exactly (`add-card-button.tsx` is the reference — do not change that file). Add:
- `const [status, setStatus] = useState(DEFAULT_LISTS[0]!.name);` — a `<select>` with one `<option>` per `DEFAULT_LISTS` entry, label `w[name as keyof typeof w]`.
- `const [boardId, setBoardId] = useState(boards[0]?.id ?? "");` — a `<select>` of `boards`, label `b.name`, labelled `w.newTaskBoardLabel`, **rendered only when `boards.length > 1`** (per spec — when there is exactly one board, skip the picker and use it directly).
- On submit: `const listId = boards.find((b) => b.id === boardId)?.lists.find((l) => l.name === status)?.id; if (!listId) return;` then call `createWorkCard(listId, { label, title, assignee, teamId, dueDate })` (unchanged action/shape) via the existing `exec`/toast pattern `AddCardButton` uses (`success: w.cardAdded`, reset fields and close on success).
- Trigger button label `w.newTask`; modal title `w.newTaskTitle`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS for this new file (other files' pre-existing expected errors from earlier tasks still outstanding until this step rewires `page.tsx`).

- [ ] **Step 3: Rewrite `page.tsx`**

- Remove the `BoardSwitcher`/`BoardHeaderCard`/`NewBoardButton` import and the `totalCards`/`inProgressCount`/`overdueCount` helper functions (no longer needed — there is no single "active board" to summarize).
- Remove `sp.b` from the `searchParams` type (keep `card`/`v`).
- Keep fetching `boards`/`teams`/`members` exactly as today (`getAccessibleBoards(user.id)` etc.) — pooling needs the same `boards` array, just used differently.
- Build each board's `SerializedList[]` exactly as the current per-card mapping does (`id`/`label`/`title`/`assignee`/`teamId`/`dueDate`/`startDate`/`checklist`), **adding** `boardId: board.id` and keeping the card's real `listId: card.listId` and new `priority: card.priority` on every mapped card.
- Pool: `const pooled = poolListsByName(boards.map((b) => b.lists.map((l) => ({ name: l.name, color: l.color, cards: mapCards(b, l) }))), DEFAULT_LISTS);` then map `pooled` to `SerializedList[]` (`id: name` — the virtual id, used only as a React key / group label, never passed to `CardModal`).
- Build `const boardListsByBoardId = Object.fromEntries(boards.map((b) => [b.id, b.lists.map((l) => ({ id: l.id, name: l.name }))]));` and `const canManageByBoardId = Object.fromEntries(boards.map((b) => [b.id, b.access === "owner"]));`.
- Empty state: `!boards.length || !pooled.some((l) => l.cards.length)` → render `<Empty icon={...} text={w.emptyBoards}>` with `<NewTaskButton boards={...} teams={teamOptions} members={members} />` inside it (reusing the existing `Empty` import/pattern), otherwise render:
  ```tsx
  <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
    <SplitHeading text={w.title} className="text-2xl font-semibold sm:text-[2rem]" />
    <NewTaskButton boards={boards.map((b) => ({ id: b.id, name: b.name, lists: b.lists.map((l) => ({ id: l.id, name: l.name })) }))} teams={teamOptions} members={members} />
  </div>
  <ViewSwitcher w={w} current={view} />
  {view === "list" ? (
    <WorkListView lists={pooled} boardListsByBoardId={boardListsByBoardId} canManageByBoardId={canManageByBoardId} teams={teamOptions} members={members} timezone={user.timezone} openCardId={sp.card} />
  ) : (
    <WorkCalendarView lists={pooled} boardListsByBoardId={boardListsByBoardId} canManageByBoardId={canManageByBoardId} teams={teamOptions} members={members} timezone={user.timezone} today={today} weekStartsOn={user.weekStartsOn} />
  )}
  ```
- Keep `sp.card` in the `searchParams` type (do **not** remove it — three existing deep-links depend on it: `src/actions/work.ts:576`'s comment-notification href, `src/app/(app)/dashboard/page.tsx:77`'s upcoming-schedule widget, and `src/app/(app)/journey/page.tsx:252`'s workspace-tasks link). Pass `openCardId={sp.card}` to `<WorkListView>` only (not `<WorkCalendarView>` — see Task 7's Interfaces note). `sp.b` is dropped (no longer read) — existing links that still include `b=...` keep working unaffected, since it's simply an ignored extra query param now.

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS (25+ existing tests plus the new `work-view.test.ts` tests from Task 2).

- [ ] **Step 6: Manual Playwright verification (golden path + Review Focus items)**

Against the real account's existing boards (5 boards: bóng/Nam An/ra mắt sản phẩm/a/đá):
1. `/workspace` with no params loads the pooled List view directly — no board tabs, no board name anywhere, cards from all 5 boards appear grouped by status. (golden path)
2. Expand/collapse a status group — toggles correctly, count stays accurate.
3. Click a card originally from a board the user does NOT own (if one exists in this account's data) — confirm its lock/approve behavior matches what it showed before this change in Table/Kanban (Review Focus 1/3) — specifically: a Done-list card not owned by the user is locked; a Review-list card owned by the user shows the Approve button.
4. Change a card's Column or Priority in the panel, save, reopen — both persisted correctly, and confirm (via a quick DB-agnostic check, e.g. the card still appears under the new status group after reload) that it moved within its *own* board, not another.
5. "+ Thêm việc" with this account's 5 boards: board picker appears (since `boards.length > 1`), create a task — appears in the right status group immediately after.
6. Switch to Lịch (Calendar) — still works, clicking a card opens the correctly-permissioned panel (same per-board check as #3, repeated for Calendar).
7. Visit `/workspace?v=kanban` and `/workspace?v=table` directly — both fall back to the List view, no crash. (Review Focus 4)
8. Build a `/workspace?b=<any-board-id>&card=<some-card-id>` URL by hand (matching what the comment-notification/Dashboard/Journey links already produce) and visit it directly — the matching card's panel opens automatically on arrival, and the `card` param is stripped from the URL afterward (same as Kanban did before). (Review Focus — deep-link)
9. Confirm no remaining import of `work-table-view.tsx` anywhere (`grep -r "work-table-view" src`) and that `kanban-board.tsx`'s own `<KanbanBoard>` component is not imported by `page.tsx` anymore, while its named utility exports still are.

Record pass/fail for each; fix forward before moving on.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/workspace/new-task-button.tsx" "src/app/(app)/workspace/page.tsx"
git commit -m "feat(workspace): pool boards into one List/Calendar view, remove board tabs, add + Thêm việc"
```
