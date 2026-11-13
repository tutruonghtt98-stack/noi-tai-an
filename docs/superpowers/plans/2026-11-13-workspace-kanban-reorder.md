# Workspace Kanban Return + Status Badges + Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Kanban back into the view switcher (pooled across boards, before "Danh sách"), restyle status headers as colored icon badges in both List and Kanban, add real drag-to-reorder for cards within a status group and for subtask items, and remove the "Loại" field from the card detail panel.

**Architecture:** Kanban is rewritten to follow the exact pooled-card-identity pattern `WorkListView`/`WorkCalendarView` already established (per-card `boardId`/`listId` resolve the real target list and the real owner permission before any mutation). Reordering within a status group is a new, independent concern: a pure `reorderIds` helper computes the new id order from a drag event, a new `reorderWorkCards` server action persists it by renumbering `WorkCard.sortOrder` for exactly the ids given (authorization-checked per card, same as every other card mutation), and `poolListsByName` sorts each pooled group by `sortOrder` so the new order survives a reload and is consistent across boards sharing one status group.

**Tech Stack:** Next.js Server Actions + Prisma/Postgres (no schema change — reuses `WorkCard.sortOrder`), Zod, native HTML5 drag-and-drop (`draggable`/`onDragOver`/`onDrop`) for the new reorder-handle interaction (separate from Kanban's existing custom pointer-based cross-column drag), `tsx --test` for the new pure logic, Playwright MCP for manual UI verification.

**Spec:** `docs/superpowers/specs/2026-11-13-workspace-kanban-reorder-design.md`

## Global Constraints

- Do not change `assigneeUserId`, permission checks, discipline scoring, Journey achievement sync, or `WorkCardEvent` — `reorderWorkCards` only ever writes `sortOrder`, never a scoring-relevant field.
- No schema change — `WorkCard.sortOrder` (already `Int`) is reused; comparing it across boards within one pooled status group is the new, deliberate meaning assigned to it by this plan.
- Keep `AssigneePicker`, `add-card-button.tsx` (file kept, just no longer called from Kanban), and `card-modal.tsx`'s label/`setLabel` state intact — only the "Loại" input/label JSX is removed from the panel; the underlying field must still round-trip through `saveInfo()` unchanged, or every save from the panel would silently null out the card's label.
- Reordering within a group never changes a card's list/board/status — only its `sortOrder`. Dragging to a different Kanban column stays `moveWorkCard` (existing, unchanged behavior), never `reorderWorkCards`.
- `reorderWorkCards` must reject (not partially apply) when any card in the given id list fails the existing `canActOnCard` permission check — matching the all-or-nothing pattern already used elsewhere in `work.ts`.

## Review Focus

- Dragging a card to reorder it within a pooled status group that contains cards from 2+ different boards must renumber every card in that group (not just the ones from the dragged card's own board) — a partial renumbering would silently un-sort the other board's cards.
- A user without permission on one of the cards in a `reorderWorkCards` call (e.g. a stale client state referencing a card that was deleted or whose access changed) must have the whole reorder rejected, not applied to the cards that do pass.
- Removing the "Loại" field from the panel must not erase an existing card's label on the next save — the field's value must still flow through `saveInfo()`'s `updateWorkCard` payload unchanged.
- Kanban's cross-column drag-and-drop, now pooled, must move a card into its *own* board's real target list — the same per-card `boardId`-aware resolution `WorkListView`/`WorkCalendarView` already use for the detail panel, applied here to the drop target too.
- `reorderWorkCards` called with an empty array, a single id, or 200+ ids must be rejected by validation before any database write (the exact boundary the plan's zod schema sets), not silently accepted or truncated.

---

## File Structure

- Modify `src/actions/work.ts` — new `reorderWorkCards` action.
- Modify `src/lib/work-view.ts` — `WorkView` gains `"kanban"`; `poolListsByName` sorts each pooled group by `sortOrder`; new pure `reorderIds` helper.
- Modify `src/lib/work-view.test.ts` — update existing fixtures for the new `sortOrder` requirement; add tests for sorting and for `reorderIds`.
- Modify `src/app/(app)/workspace/kanban-board.tsx` — `STATUS_BADGE_CLASS`/`STATUS_ICON` exports; pooled-aware props and drag-drop target resolution; colored badge column headers; remove per-column `AddCardButton`; add drag-handle same-column reorder.
- Modify `src/app/(app)/workspace/work-list-view.tsx` — colored badge group headers; add drag-handle same-group reorder.
- Modify `src/app/(app)/workspace/card-modal.tsx` — remove the "Loại" field's JSX only (state/payload untouched); add drag-handle reorder to the Subtask list.
- Modify `src/app/(app)/workspace/view-switcher.tsx` — add Kanban first.
- Modify `src/app/(app)/workspace/page.tsx` — render the Kanban branch; add `sortOrder` to each mapped card.
- Modify `src/lib/i18n/vi.ts` and `src/lib/i18n/en.ts` — `viewList` value becomes "Danh sách" (vi only); new `dragHandleLabel` key.

---

### Task 1: `reorderWorkCards` action + `reorderIds` pure helper

**Files:**
- Modify: `src/actions/work.ts`
- Modify: `src/lib/work-view.ts`
- Modify: `src/lib/work-view.test.ts`

**Interfaces:**
- Consumes: existing `canActOnCard`, `run`, `UserError`, `getUserTeamIds`, `db` (all already in `work.ts`, unchanged).
- Produces (used by Tasks 3-4):
  - `reorderWorkCards(cardIds: string[]): Promise<Result<undefined>>`
  - `reorderIds(ids: string[], draggedId: string, targetId: string): string[]` — pure; removes `draggedId` from its current position and reinserts it immediately before `targetId`'s position in the *resulting* array (i.e. `targetId` ends up directly after `draggedId`). Returns a new array; does not mutate `ids`. If either id is not found, or they are equal, returns `ids` unchanged (copy).

- [ ] **Step 1: Write failing tests for `reorderIds`**

```ts
test("reorderIds moves the dragged id to just before the target id", () => {
  assert.deepEqual(reorderIds(["a", "b", "c", "d"], "d", "b"), ["a", "d", "b", "c"]);
  assert.deepEqual(reorderIds(["a", "b", "c", "d"], "a", "c"), ["b", "a", "c", "d"]);
});

test("reorderIds is a no-op copy when ids are equal or missing", () => {
  assert.deepEqual(reorderIds(["a", "b"], "a", "a"), ["a", "b"]);
  assert.deepEqual(reorderIds(["a", "b"], "z", "b"), ["a", "b"]);
});

test("reorderIds does not mutate its input array", () => {
  const original = ["a", "b", "c"];
  reorderIds(original, "c", "a");
  assert.deepEqual(original, ["a", "b", "c"]);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — `reorderIds` not defined.

- [ ] **Step 3: Implement `reorderIds` in `work-view.ts`**

```ts
export function reorderIds(ids: string[], draggedId: string, targetId: string): string[] {
  if (draggedId === targetId || !ids.includes(draggedId) || !ids.includes(targetId)) return [...ids];
  const without = ids.filter((id) => id !== draggedId);
  const targetIndex = without.indexOf(targetId);
  return [...without.slice(0, targetIndex), draggedId, ...without.slice(targetIndex)];
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Implement `reorderWorkCards` in `work.ts`**

Add near `updateWorkCardChecklist`:

```ts
const reorderCardIdsSchema = z.array(z.string().min(1)).min(1).max(200);

export async function reorderWorkCards(cardIds: string[]) {
  return run(async () => {
    const user = await requireUser();
    const ids = reorderCardIdsSchema.parse(cardIds);
    const userTeamIds = await getUserTeamIds(user.id);
    const cards = await db.workCard.findMany({
      where: { id: { in: ids } },
      select: { id: true, assigneeUserId: true, teamId: true, list: { select: { board: { select: { userId: true } } } } },
    });
    if (cards.length !== ids.length) throw new UserError("VALIDATION");
    for (const card of cards) {
      if (!canActOnCard(card, user.id, userTeamIds)) throw new UserError("VALIDATION");
    }
    await db.$transaction(ids.map((id, index) => db.workCard.update({ where: { id }, data: { sortOrder: index } })));
    revalidatePath("/workspace");
  });
}
```

This is all-or-nothing by construction: the permission loop throws (aborting `run`, writing nothing) before the `$transaction` call if any card fails — covers Review Focus item 2.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/actions/work.ts src/lib/work-view.ts src/lib/work-view.test.ts
git commit -m "feat(workspace): add reorderWorkCards action and the reorderIds pure helper"
```

---

### Task 2: Pool-by-`sortOrder`, `WorkView` gains Kanban, status badge metadata, i18n

**Files:**
- Modify: `src/lib/work-view.ts`
- Modify: `src/lib/work-view.test.ts`
- Modify: `src/app/(app)/workspace/kanban-board.tsx`
- Modify: `src/lib/i18n/vi.ts` and `src/lib/i18n/en.ts`

**Interfaces:**
- Produces (used by Tasks 3-6):
  - `WorkView = "kanban" | "list" | "calendar"` (default via `parseWorkView` stays `"list"` — only the valid set grows).
  - `poolListsByName<TCard extends { sortOrder: number }>(...)` — now sorts each group's merged `cards` by `sortOrder` ascending before returning.
  - `export const STATUS_BADGE_CLASS: Record<string, string>` and `export const STATUS_ICON: Record<string, LucideIcon>` in `kanban-board.tsx`.
  - `t.work.workspace.viewList` (vi) = `"Danh sách"`; `t.work.workspace.dragHandleLabel` (new key).

- [ ] **Step 1: Update existing `poolListsByName` tests for the `sortOrder` constraint**

Replace the `TestPoolCard`/fixtures in `work-view.test.ts`'s existing `poolListsByName` tests to include `sortOrder`:

```ts
type TestPoolCard = { id: string; sortOrder: number };
const poolOrder = [
  { name: "listToDo", color: "muted" },
  { name: "listDone", color: "jade" },
];

test("poolListsByName merges same-named lists across boards, in order's sequence", () => {
  const boardA = [{ name: "listToDo", color: "muted", cards: [{ id: "a1", sortOrder: 0 }] }];
  const boardB = [
    { name: "listToDo", color: "muted", cards: [{ id: "b1", sortOrder: 1 }] },
    { name: "listDone", color: "jade", cards: [{ id: "b2", sortOrder: 0 }] },
  ];
  const pooled = poolListsByName<TestPoolCard>([boardA, boardB], poolOrder);
  assert.deepEqual(pooled.map((l) => l.name), ["listToDo", "listDone"]);
  assert.deepEqual(pooled[0]!.cards.map((c) => c.id), ["a1", "b1"]);
  assert.deepEqual(pooled[1]!.cards.map((c) => c.id), ["b2"]);
});

test("poolListsByName treats a board missing a named list as contributing no cards for it", () => {
  const boardWithoutDone = [{ name: "listToDo", color: "muted", cards: [{ id: "x", sortOrder: 0 }] }];
  const pooled = poolListsByName<TestPoolCard>([boardWithoutDone], poolOrder);
  assert.deepEqual(pooled[1]!.cards, []);
});

test("poolListsByName sorts a group's merged cards by sortOrder, across boards", () => {
  const boardA = [{ name: "listToDo", color: "muted", cards: [{ id: "a-high", sortOrder: 5 }] }];
  const boardB = [{ name: "listToDo", color: "muted", cards: [{ id: "b-low", sortOrder: 1 }] }];
  const pooled = poolListsByName<TestPoolCard>([boardA, boardB], poolOrder);
  assert.deepEqual(pooled[0]!.cards.map((c) => c.id), ["b-low", "a-high"]);
});
```

- [ ] **Step 2: Run tests, verify the first two still pass and the new one fails**

Run: `npm test`
Expected: the two pre-existing tests (now with `sortOrder` added to fixtures but unsorted-order assertions unchanged, since board A's card already precedes board B's in those fixtures) PASS; the new sort-order test FAILS (`poolListsByName` doesn't sort yet).

- [ ] **Step 3: Update `poolListsByName`'s signature and add the sort step**

```ts
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
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Add `"kanban"` to `WorkView`**

```ts
export type WorkView = "kanban" | "list" | "calendar";
const WORK_VIEWS: WorkView[] = ["kanban", "list", "calendar"];
```
`parseWorkView`'s fallback stays `"list"` (unchanged) — only the accepted set grows.

- [ ] **Step 6: Add a test confirming `"kanban"` is now valid**

Add to the existing `parseWorkView` "returns the value when valid" test:
```ts
assert.equal(parseWorkView("kanban"), "kanban");
```
Remove the now-stale assertion in the "defaults" test that `parseWorkView("kanban")` falls back to `"list"` (it no longer does — kanban is valid again).

- [ ] **Step 7: Run tests, verify PASS**

Run: `npm test`
Expected: PASS, full suite.

- [ ] **Step 8: Add `STATUS_BADGE_CLASS`/`STATUS_ICON` to `kanban-board.tsx`**

```ts
import { AlertCircle, CheckCircle2, Circle, Clock, Eye, type LucideIcon } from "lucide-react";
// ...next to PRIORITY_BADGE_CLASS:
export const STATUS_BADGE_CLASS: Record<string, string> = {
  muted: "bg-muted/15 text-ink-2",
  mist: "bg-mist/15 text-mist-ink",
  ochre: "bg-ochre/15 text-ochre-ink",
  jade: "bg-jade/15 text-jade-ink",
  danger: "bg-danger/15 text-danger",
};
export const STATUS_ICON: Record<string, LucideIcon> = {
  listToDo: Circle,
  listInProgress: Clock,
  listReview: Eye,
  listDone: CheckCircle2,
  listOverdue: AlertCircle,
};
```

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 10: Update i18n**

`viewKanban` was removed from both dictionaries during the previous (pooled-list) plan — add it back. `vi.ts`: add `viewKanban: "Kanban",` immediately before `viewList`, and change `viewList: "List"` to `viewList: "Danh sách"`. Add `dragHandleLabel: "Kéo để đổi thứ tự"` next to it. `en.ts`: add `viewKanban: "Kanban",` immediately before `viewList`; keep `viewList: "List"` unchanged; add `dragHandleLabel: "Drag to reorder"`.

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/lib/work-view.ts src/lib/work-view.test.ts "src/app/(app)/workspace/kanban-board.tsx" src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "feat(workspace): sort pooled groups by sortOrder, re-add kanban to WorkView, add status badge metadata"
```

---

### Task 3: `work-list-view.tsx` — colored badge headers + drag-handle reorder

**Files:**
- Modify: `src/app/(app)/workspace/work-list-view.tsx`

**Interfaces:**
- Consumes: `STATUS_BADGE_CLASS`, `STATUS_ICON` from `./kanban-board` (Task 2); `reorderIds` from `@/lib/work-view` (Task 1); `reorderWorkCards` from `@/actions/work` (Task 1); `w.dragHandleLabel` (Task 2).
- Produces: `WorkListView`'s public signature is unchanged (same props as today) — this task only changes its internal rendering/interaction.

- [ ] **Step 1: Replace the group header's dot+text with a colored icon badge**

Replace:
```tsx
<span className={`size-2 shrink-0 rounded-full ${DOT[list.color] ?? "bg-muted"}`} aria-hidden />
<span className="font-medium">{w[list.name as keyof typeof w] ?? list.name}</span>
```
with a badge using `STATUS_BADGE_CLASS[list.color]` as the background/text classes and `STATUS_ICON[list.name]` as the leading icon (render the icon component directly, e.g. `const Icon = STATUS_ICON[list.name] ?? Circle;` then `<Icon className="size-3.5" aria-hidden />`), inside a `<span className={cn("badge", STATUS_BADGE_CLASS[list.color])}>` wrapper so it reads as one colored pill (icon + label), matching the reference image. Keep the existing `({list.cards.length})` count and chevron after it, unchanged.

- [ ] **Step 2: Add a drag handle column and same-group reorder**

Add a new first `<th>`/`<td>` (empty header, `GripVertical` icon in each row, `aria-label={w.dragHandleLabel}`) before the title column. Make each `<tr>` `draggable`, wire:
```ts
const [draggedId, setDraggedId] = useState<string | null>(null);
```
`onDragStart={() => setDraggedId(card.id)}` on the grip handle (or the row); `onDragOver={(e) => e.preventDefault()}` on each row; `onDrop={() => { if (!draggedId || draggedId === card.id) return; const ids = list.cards.map((c) => c.id); const next = reorderIds(ids, draggedId, card.id); exec(() => reorderWorkCards(next)); setDraggedId(null); }}` on each row (same `list` the two cards belong to — reordering is always within one rendered group, so `list.cards` is already the exact scope `reorderIds` needs). This requires `useAction()`'s `exec` — add the import/hook if the file doesn't already have it.

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/workspace/work-list-view.tsx"
git commit -m "feat(workspace): colored status badges and drag-to-reorder in the List view"
```

---

### Task 4: `kanban-board.tsx` — pooled-aware rewrite + badges + reorder

**Files:**
- Modify: `src/app/(app)/workspace/kanban-board.tsx`

**Interfaces:**
- Consumes: `boardListsByBoardId`/`canManageByBoardId` shape (same as `WorkListView`/`WorkCalendarView`); `reorderIds`/`reorderWorkCards` (Task 1); `STATUS_BADGE_CLASS`/`STATUS_ICON` (Task 2, same file).
- Produces: `KanbanBoard`'s props become `{ lists, boardListsByBoardId, canManageByBoardId, teams, members, openCardId, timezone }` — **`canManage` prop is removed** (same change `WorkListView`/`WorkCalendarView` already made). Consumed by Task 6 / `page.tsx`.

- [ ] **Step 1: Replace the `canManage` prop with the two maps**

Remove `canManage = true` and its type; add `boardListsByBoardId: Record<string, { id: string; name: string }[]>` and `canManageByBoardId: Record<string, boolean>` (same types `WorkListView` uses).

- [ ] **Step 2: Fix the `CardModal` wiring**

Replace the existing `listOptions`/`doneListId`/`reviewListId` (currently computed once from the pooled `lists`, which is wrong post-pooling) with the same per-card lookup `WorkListView`/`WorkCalendarView` already use:
```ts
const boardListsRaw = (openCard && boardListsByBoardId[openCard.card.boardId]) || [];
const boardLists = boardListsRaw.map((l) => ({ id: l.id, name: w[l.name as keyof typeof w] ?? l.name }));
const doneListId = boardListsRaw.find((l) => l.name === "listDone")?.id;
const reviewListId = boardListsRaw.find((l) => l.name === "listReview")?.id;
const canDelete = openCard ? (canManageByBoardId[openCard.card.boardId] ?? false) : true;
```
Pass `lists={boardLists}` and `canDelete={canDelete}` to `<CardModal>`.

- [ ] **Step 3: Resolve the real drop target on cross-column drag**

In `onCardPointerUp`, `overListId` is the *virtual* status name (the pooled column's `list.id`, which `page.tsx` sets to `list.name`). Before calling `moveWorkCard`, resolve the dragged card's own board's real list id:
```ts
if (wasDragging && overListId && overListId !== p?.fromListId) {
  const realTargetId = boardListsByBoardId[card.boardId]?.find((l) => l.name === overListId)?.id;
  if (realTargetId) exec(() => moveWorkCard(card.id, realTargetId));
}
```
Covers Review Focus item 4.

- [ ] **Step 4: Fix the done-list drag lock and approve/locked checks to be per-card**

Replace the `!canManage` in `setOverListId(hoveredId && hoveredId === doneListId && !canManage ? null : hoveredId)` — `doneListId` here is still the *dragged card's own* done-list id, computed per-pointer-down (not a single page-wide value anymore, since different columns can have different real done-list ids depending on board). Compute it from `pending.current.card.boardId` inside `onCardPointerMove`:
```ts
const draggedBoardLists = p && boardListsByBoardId[p.card.boardId];
const draggedDoneListId = draggedBoardLists?.find((l) => l.name === "listDone")?.id;
// draggedDoneListId is a *real* id; overListId (hoveredId) is a *virtual* status name — compare by resolving hoveredId's name against the same board instead:
const hoveredIsDone = hoveredId === "listDone"; // hoveredId is already the virtual name per page.tsx's id=list.name convention
setOverListId(hoveredIsDone && !(canManageByBoardId[p?.card.boardId ?? ""] ?? false) ? null : hoveredId);
```
Replace `showApprove`/`locked` (currently `canManage && list.name === "listReview"` / `list.name === "listDone" && !canManage`) with the per-card equivalent: `showApprove = (canManageByBoardId[card.boardId] ?? false) && list.name === "listReview" && !!boardListsByBoardId[card.boardId]?.find((l) => l.name === "listDone")`; `locked = list.name === "listDone" && !(canManageByBoardId[card.boardId] ?? false)`.
`approveCard(card)` resolves its own target: `const target = boardListsByBoardId[card.boardId]?.find((l) => l.name === "listDone")?.id; if (!target) return; exec(() => moveWorkCard(card.id, target), ...)`.

- [ ] **Step 5: Remove the per-column `AddCardButton`**

Delete the `import { AddCardButton } from "./add-card-button";` line and the `{canManage && <AddCardButton listId={list.id} teams={teams} members={members} />}` JSX — `list.id` is a virtual status name post-pooling, so this button could never have worked correctly anyway. Task creation is now exclusively via the page-level "+ Thêm việc" button, same as List/Calendar.

- [ ] **Step 6: Colored badge column headers**

Same change as Task 3 Step 1 — replace the dot+text column header with the `STATUS_BADGE_CLASS`/`STATUS_ICON` badge.

- [ ] **Step 7: Add a drag handle and same-column reorder**

Add a small `GripVertical` handle (top-left corner of each card, `aria-label={w.dragHandleLabel}`) that starts the *existing* custom pointer-drag (reuse `onCardPointerDown`/`onCardPointerMove`/`onCardPointerUp` — they already support cross-column moves via Step 3's fix). For same-column reorder specifically: when `onCardPointerUp` detects `wasDragging && overListId === p?.fromListId` (dropped back in the same column, at a different vertical position), compute the new order by whichever card the pointer ended up nearest to (same approach as Task 3: track a `draggedId`/target via `document.elementFromPoint` resolving to a card element's `data-card-id`, reuse `reorderIds` on that column's `list.cards.map(c => c.id)`, then `exec(() => reorderWorkCards(next))`) instead of doing nothing (today's code only acts when `overListId !== p?.fromListId`).

- [ ] **Step 8: Type-check and build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/workspace/kanban-board.tsx"
git commit -m "feat(workspace): pool Kanban across boards, add status badges and drag-to-reorder, drop per-column add-card"
```

---

### Task 5: `card-modal.tsx` — remove "Loại" field, add Subtask reorder

**Files:**
- Modify: `src/app/(app)/workspace/card-modal.tsx`

**Interfaces:**
- Consumes: `reorderIds` from `@/lib/work-view`; `w.dragHandleLabel` (Task 2).
- Produces: `SerializedCard`/`CardModal`'s public signature is unchanged — this task only removes JSX and changes internal checklist rendering.

- [ ] **Step 1: Remove the "Loại" field's JSX only**

Remove this `<label>` block (the one with the `Tag` icon and `w.typeTitle`):
```tsx
<label className="field">
  <span className="label inline-flex items-center gap-1.5">
    <Tag className="size-3.5" aria-hidden /> {w.typeTitle}
  </span>
  <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={w.cardLabelPh} maxLength={30} disabled={locked} />
</label>
```
Change the surrounding grid from `sm:grid-cols-3` back to `sm:grid-cols-2` (now just Cột + Priority). **Do not remove** the `label`/`setLabel` state, the `setLabel(card.label ?? "")` line in the load effect, or `label` from `saveInfo()`'s `updateWorkCard` payload — those must keep flowing through unchanged so an existing card's label survives a save from this panel (Review Focus item 3). Remove the now-unused `Tag` import from `lucide-react` if nothing else in the file uses it.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Add a drag handle and reorder to the Subtask list**

Add a `GripVertical` handle (lucide-react) before the checkbox in each `<li>`, `aria-label={w.dragHandleLabel}`. Make the `<li>` `draggable`; wire the same drag pattern as Task 3:
```ts
const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
```
`onDragStart` on the handle sets `draggedItemId`; `onDragOver={(e) => e.preventDefault()}` on the `<li>`; `onDrop={() => { if (!draggedItemId || draggedItemId === item.id) return; const next = reorderIds(checklist.map((i) => i.id), draggedItemId, item.id).map((id) => checklist.find((i) => i.id === id)!); persistChecklist(next); setDraggedItemId(null); }}`. No new server action — `persistChecklist` already saves the full reordered array via the existing `updateWorkCardChecklist`.

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/workspace/card-modal.tsx"
git commit -m "feat(workspace): remove the Loại field and add drag-to-reorder to subtasks"
```

---

### Task 6: `view-switcher.tsx` + `page.tsx` wiring + manual verification

**Files:**
- Modify: `src/app/(app)/workspace/view-switcher.tsx`
- Modify: `src/app/(app)/workspace/page.tsx`

**Interfaces:**
- Consumes: `KanbanBoard` (Task 4, new props); `w.viewList` = "Danh sách" (Task 2).
- Produces: none further — this is the plan's final wiring task.

- [ ] **Step 1: Add Kanban to the switcher, first**

```tsx
const views: { key: WorkView; label: string }[] = [
  { key: "kanban", label: w.viewKanban },
  { key: "list", label: w.viewList },
  { key: "calendar", label: w.viewCalendar },
];
```
(`w.viewKanban` was re-added to both dictionaries in Task 2 Step 10 — this should type-check cleanly.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Render the Kanban branch in `page.tsx`**

Replace the `view === "list" ? ... : ...` two-way conditional with a three-way one, adding:
```tsx
{view === "kanban" ? (
  <KanbanBoard
    lists={lists}
    boardListsByBoardId={boardListsByBoardId}
    canManageByBoardId={canManageByBoardId}
    teams={teamOptions}
    members={members}
    timezone={user.timezone}
    openCardId={sp.card}
  />
) : view === "list" ? (
  /* unchanged WorkListView call */
) : (
  /* unchanged WorkCalendarView call */
)}
```

- [ ] **Step 4: Add `sortOrder` to each mapped card**

In the card-mapping literal inside `poolListsByName(...)`'s argument, add `sortOrder: card.sortOrder,` alongside the existing fields (Prisma's `WorkCard.sortOrder` is already selected by default via `getAccessibleBoards`'s unselected `include`, same as `startDate`/`priority` were — no query change needed).

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both PASS.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Manual Playwright verification (golden path + Review Focus items)**

1. `/workspace` → Kanban is now the first tab; switch to it — cards from multiple boards appear pooled in each column (same cards List/Calendar already show). (golden path)
2. Drag a card from one Kanban column to another — it moves, and reopening its detail panel shows the new status persisted; confirm (by reading `boardListsByBoardId`'s real id was used, not the virtual one) no console error and the card didn't jump to a different board's list silently. (Review Focus 4)
3. In a status group with cards from 2+ different boards (if this account's data has one — this account's boards all share column names, so any group with ≥2 boards contributing qualifies), drag one card to reorder it past a card from a different board; reload the page; confirm the new order persisted for *all* cards in that group, not just the dragged card's own board's cards. (Review Focus 1)
4. Drag-reorder a subtask item in the detail panel; reload the card; confirm the new order persisted.
5. Open a card, confirm there is no "Loại" field anymore, change something else (e.g. Priority) and save; reopen — confirm the card's label/badge (shown next to its title in Kanban/List) is unchanged, not cleared. (Review Focus 3)
6. Confirm the Kanban column headers and List group headers both show a colored badge with a leading icon, matching the reference image's look, for all 5 statuses.
7. "Danh sách" tab label (not "List") renders in Vietnamese.

Record pass/fail for each; fix forward before moving on.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/workspace/view-switcher.tsx" "src/app/(app)/workspace/page.tsx"
git commit -m "feat(workspace): re-add Kanban to the view switcher and wire it into the page"
```
