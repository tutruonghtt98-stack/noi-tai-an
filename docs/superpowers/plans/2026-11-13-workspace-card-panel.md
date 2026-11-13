# Workspace Card Detail — Right-Side Panel (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the centered `<Modal>` card-detail popup with a right-side sliding panel, and add Timeline (startDate), richer Subtasks (per-item description), and link-only Attachments — without touching assignment/permission/discipline-scoring/audit logic.

**Architecture:** `card-modal.tsx` stops using the shared `Modal` component and renders its own `<dialog>` (same native `showModal()`/`close()` lifecycle, new `.side-panel` CSS anchored right instead of centered). New Prisma additions (`WorkCard.startDate`, `WorkCardAttachment`) and new server actions follow the exact patterns `dueDate` and `WorkCardComment` already use in this codebase. Attachments are link-only (no file upload, no new storage infra) and capped at 10/card.

**Tech Stack:** Next.js Server Actions + Prisma/Postgres, Zod validation, native `<dialog>` element, `tsx --test` for any pure-logic tests, Playwright MCP for manual UI verification (no component-test harness in this repo).

**Spec:** `docs/superpowers/specs/2026-11-13-workspace-card-panel-design.md`

## Global Constraints

- Do not change `assigneeUserId`, permission checks (`canActOnCard`/`isBoardOwner`), discipline scoring (`syncOverdueDiscipline`), Journey achievements (`syncJourneyAchievements`), or the `WorkCardEvent` audit trail — all stay exactly as they are. Multi-assignee permissions/scoring is explicitly Phase B, out of scope here.
- Attachments are link-only: store `url` (+ optional `label`), never a file's bytes. Cap at **10 attachments per card**.
- Do not change the shared `Modal` component (`src/components/ui/modal.tsx`) — other callers across the app still use it as-is.
- Do not change `kanban-board.tsx`, `work-table-view.tsx`, or `work-calendar-view.tsx`'s card-preview rendering (`CardBody`, table rows, calendar chips) — `startDate` is only shown inside the detail panel.
- Any `npx prisma db push` against the shared dev/prod database requires explicit confirmation from the human partner before running it (standing project rule) — the task that needs it says so explicitly.

## Review Focus

- Adding an 11th attachment to a card must fail with a clear, Vietnamese toast (not silently no-op or silently exceed the cap).
- An invalid attachment URL (not a URL, or empty) must be rejected by validation before anything is written to the database.
- A locked card (in the Done list, viewed by someone who isn't the board owner) must still block adding/deleting attachments and editing subtask descriptions — the same lock that already blocks editing title/checklist today must cover the new fields too, not leave a side door open.
- Reopening a card after saving `startDate` must show the same local date/time back (same timezone round-trip `dueDate` already does correctly), not shift by the server's timezone.
- Closing the panel via Escape or by clicking the backdrop (not just the explicit close button) must still call `onClose` and leave the panel fully closed, not stuck half-open.

---

## File Structure

- Modify `prisma/schema.prisma` — add `WorkCard.startDate`, new `WorkCardAttachment` model + relation.
- Modify `src/lib/work-types.ts` — extend `ChecklistItem` with optional `description`.
- Modify `src/actions/work.ts` — `cardSchema`/`checklistItemSchema` additions, `startDate` persistence in create/update, three new attachment actions.
- Modify `src/lib/use-action.ts` — map the new `ATTACHMENT_LIMIT` error code to Vietnamese text.
- Modify `src/lib/i18n/vi.ts` and `src/lib/i18n/en.ts` — new copy for People/Timeline/Type/Attachments sections.
- Modify `src/app/globals.css` — new `.side-panel` dialog styling (slide in from the right), left untouched: `.modal`.
- Modify `src/app/(app)/workspace/card-modal.tsx` — stop using `Modal`, render the new panel shell, add the new fields/sections.

---

### Task 1: Schema — `startDate` and `WorkCardAttachment`

**Files:**
- Modify: `prisma/schema.prisma` (`WorkCard` model, around line 393)

**Interfaces:**
- Produces (used by Task 2): `WorkCard.startDate: DateTime?`, `WorkCard.attachments: WorkCardAttachment[]`, new model:
  ```prisma
  model WorkCardAttachment {
    id        String   @id @default(cuid())
    cardId    String
    url       String
    label     String?
    createdAt DateTime @default(now())

    card WorkCard @relation(fields: [cardId], references: [id], onDelete: Cascade)

    @@index([cardId])
  }
  ```

- [ ] **Step 1: Add `startDate DateTime?` to `WorkCard`**

Add the field right next to `dueDate` in the `WorkCard` model, and add `attachments WorkCardAttachment[]` next to the existing `comments WorkCardComment[]` relation line.

- [ ] **Step 2: Add the `WorkCardAttachment` model**

Exact shape as in Interfaces above, placed directly after `model WorkCardComment` in the file.

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Stop and confirm before touching the shared database**

Ask your human partner to confirm before running `npx prisma db push` — this is a schema change against the shared dev/prod Postgres database, which this project's standing rule requires confirming every time. Do not proceed to Step 5 without that confirmation.

- [ ] **Step 5: Push the schema and regenerate the client**

Run: `npx prisma db push`
Run: `npx prisma generate`
Expected: both complete without errors.

- [ ] **Step 6: Verify the generated client picked up the new types**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors — nothing references the new fields yet).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(workspace): add WorkCard.startDate and WorkCardAttachment schema"
```

---

### Task 2: Server actions — startDate, subtask description, attachments

**Files:**
- Modify: `src/lib/work-types.ts`
- Modify: `src/actions/work.ts`
- Modify: `src/lib/use-action.ts`

**Interfaces:**
- Consumes: `WorkCard.startDate`/`WorkCardAttachment` from Task 1; existing `canActOnCard`, `isBoardOwner`, `isDoneList`, `run`, `UserError`, `zonedDateTimeToUTC`, `getUserTeamIds` (all already in `work.ts`, unchanged).
- Produces (used by Task 4):
  - `ChecklistItem = { id: string; text: string; done: boolean; description?: string }`
  - `cardSchema` (and therefore `CardInput`/`CardUpdateInput`) gains optional `startDate`, same shape/transform as the existing `dueDate` field.
  - `updateWorkCardChecklist(id: string, checklist: { id: string; text: string; done: boolean; description?: string }[])` — same signature shape, new optional field allowed.
  - `listWorkCardAttachments(cardId: string): Promise<Result<{ id: string; url: string; label: string | null }[]>>`
  - `addWorkCardAttachment(cardId: string, input: { url: string; label?: string }): Promise<Result<undefined>>` — throws `UserError("ATTACHMENT_LIMIT")` at 10 existing attachments.
  - `deleteWorkCardAttachment(id: string): Promise<Result<undefined>>`

- [ ] **Step 1: Extend `ChecklistItem` in `src/lib/work-types.ts`**

```ts
export type ChecklistItem = { id: string; text: string; done: boolean; description?: string };
```

- [ ] **Step 2: Extend `checklistItemSchema` in `work.ts`**

Add `description: z.string().trim().max(300).optional().transform((v) => v || undefined)` to the existing `checklistItemSchema` object (line 420). Update `updateWorkCardChecklist`'s parameter type to match the new `ChecklistItem` shape.

- [ ] **Step 3: Add `startDate` to `cardSchema`**

Add a field with the exact same shape as the existing `dueDate` field in `cardSchema` (line ~216):
```ts
startDate: z.string().trim().optional().transform((v) => v || null),
```

- [ ] **Step 4: Persist `startDate` in `createWorkCard`**

In `createWorkCard` (line ~270), add `const startDate = data.startDate ? zonedDateTimeToUTC(data.startDate, user.timezone) : null;` next to the existing `dueDate` line, and add `startDate` to the `tx.workCard.create({ data: { ...data, dueDate, startDate, ... } })` call (overriding the raw string from the `...data` spread, exactly like `dueDate` already does).

- [ ] **Step 5: Persist `startDate` in `updateWorkCard`**

Same pattern in `updateWorkCard` (line ~322): compute `startDate` the same way next to the existing `dueDate` computation, and include it in the `tx.workCard.update({ data: { ...data, dueDate, startDate, ... } })` call.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Add the three attachment actions to `work.ts`**

Add a new `// ---------- Đính kèm thẻ ----------` section (after the comments section, end of file) with:

```ts
const attachmentSchema = z.object({
  url: z.string().trim().url().max(2000),
  label: z.string().trim().max(80).optional().transform((v) => v || null),
});

export async function listWorkCardAttachments(cardId: string) {
  return run(async () => {
    const user = await requireUser();
    const card = await db.workCard.findUnique({
      where: { id: cardId },
      select: { assigneeUserId: true, teamId: true, list: { select: { board: { select: { userId: true } } } } },
    });
    if (!card) throw new UserError("VALIDATION");
    const userTeamIds = await getUserTeamIds(user.id);
    if (!canActOnCard(card, user.id, userTeamIds)) throw new UserError("VALIDATION");
    const attachments = await db.workCardAttachment.findMany({ where: { cardId }, orderBy: { createdAt: "asc" } });
    return attachments.map((a) => ({ id: a.id, url: a.url, label: a.label }));
  });
}

export async function addWorkCardAttachment(cardId: string, input: { url: string; label?: string }) {
  return run(async () => {
    const user = await requireUser();
    const card = await db.workCard.findUnique({
      where: { id: cardId },
      select: { assigneeUserId: true, teamId: true, list: { select: { name: true, board: { select: { userId: true } } } } },
    });
    if (!card) throw new UserError("VALIDATION");
    const userTeamIds = await getUserTeamIds(user.id);
    if (!canActOnCard(card, user.id, userTeamIds)) throw new UserError("VALIDATION");
    if (isDoneList(card.list.name) && !isBoardOwner(card.list.board, user.id)) throw new UserError("VALIDATION");
    const data = attachmentSchema.parse(input);
    const count = await db.workCardAttachment.count({ where: { cardId } });
    if (count >= 10) throw new UserError("ATTACHMENT_LIMIT");
    await db.workCardAttachment.create({ data: { cardId, url: data.url, label: data.label } });
    revalidatePath("/workspace");
  });
}

export async function deleteWorkCardAttachment(id: string) {
  return run(async () => {
    const user = await requireUser();
    const attachment = await db.workCardAttachment.findUnique({
      where: { id },
      select: {
        card: { select: { assigneeUserId: true, teamId: true, list: { select: { name: true, board: { select: { userId: true } } } } } },
      },
    });
    if (!attachment) throw new UserError("VALIDATION");
    const userTeamIds = await getUserTeamIds(user.id);
    if (!canActOnCard(attachment.card, user.id, userTeamIds)) throw new UserError("VALIDATION");
    if (isDoneList(attachment.card.list.name) && !isBoardOwner(attachment.card.list.board, user.id)) throw new UserError("VALIDATION");
    await db.workCardAttachment.delete({ where: { id } });
    revalidatePath("/workspace");
  });
}
```

This mirrors `listWorkCardComments`/`addWorkCardComment`'s exact permission pattern (`canActOnCard` + the same done-list lock check `updateWorkCard` already uses), so locked cards and permission boundaries behave identically to every other card mutation — covers Review Focus item 3.

- [ ] **Step 8: Map the new error code in `src/lib/use-action.ts`**

Add, alongside the existing `CHALLENGE_CRITERIA_INCOMPLETE` line:
```ts
if (code === "ATTACHMENT_LIMIT") return t.work.workspace.attachmentLimitReached;
```
(The i18n key is added in Task 3 — if Task 3 hasn't run yet when reaching this step, add the key now instead of waiting.)

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/work-types.ts src/actions/work.ts src/lib/use-action.ts
git commit -m "feat(workspace): add startDate, subtask description, and link attachments to card actions"
```

---

### Task 3: i18n copy

**Files:**
- Modify: `src/lib/i18n/vi.ts` (inside `work.workspace`, after `commentSent` at line 554)
- Modify: `src/lib/i18n/en.ts` (mirror, same key names)

**Interfaces:**
- Produces: new keys under `t.work.workspace` consumed by Task 4 and by Task 2 Step 8: `peopleTitle`, `timelineTitle`, `startDateLabel`, `typeTitle`, `subtaskDescriptionPh`, `attachmentsTitle`, `attachmentsEmpty`, `attachmentUrlPh`, `attachmentLabelPh`, `attachmentAdd`, `attachmentAdded`, `attachmentDeleted`, `attachmentLimitReached`.

- [ ] **Step 1: Add the keys to `vi.ts`**

```ts
peopleTitle: "Người phụ trách",
timelineTitle: "Thời gian",
startDateLabel: "Bắt đầu",
typeTitle: "Loại",
subtaskDescriptionPh: "Mô tả (tuỳ chọn)",
attachmentsTitle: "Đính kèm",
attachmentsEmpty: "Chưa có đính kèm nào.",
attachmentUrlPh: "Dán link…",
attachmentLabelPh: "Tên hiển thị (tuỳ chọn)",
attachmentAdd: "Thêm",
attachmentAdded: "Đã thêm đính kèm",
attachmentDeleted: "Đã xoá đính kèm",
attachmentLimitReached: "Mỗi thẻ chỉ được tối đa 10 đính kèm.",
```

- [ ] **Step 2: Add the same keys (English values) to `en.ts`**

```ts
peopleTitle: "People",
timelineTitle: "Timeline",
startDateLabel: "Start",
typeTitle: "Type",
subtaskDescriptionPh: "Description (optional)",
attachmentsTitle: "Attachments",
attachmentsEmpty: "No attachments yet.",
attachmentUrlPh: "Paste a link…",
attachmentLabelPh: "Display name (optional)",
attachmentAdd: "Add",
attachmentAdded: "Attachment added",
attachmentDeleted: "Attachment deleted",
attachmentLimitReached: "Each card can have at most 10 attachments.",
```

- [ ] **Step 3: Verify both dictionaries still type-check against each other**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "feat(workspace): add i18n copy for card panel's People/Timeline/Type/Attachments"
```

---

### Task 4: Side panel shell + new sections in `card-modal.tsx`

**Files:**
- Modify: `src/app/globals.css` (after the existing `dialog.modal` block, around line 589)
- Modify: `src/app/(app)/workspace/card-modal.tsx`

**Interfaces:**
- Consumes: `startDate`/`WorkCardAttachment` fields and the 3 attachment actions from Task 2; i18n keys from Task 3; `ChecklistItem` (with `description?`) from Task 2 Step 1.
- Produces: `CardModal` keeps its existing exported signature (`SerializedCard` gains `startDate: string | null`) — `kanban-board.tsx`, `work-table-view.tsx`, `work-calendar-view.tsx` need no changes, since they only ever pass `card`/`listId`/`lists`/`teams`/`members`/`reviewListId`/`doneListId`/`onClose`/`canDelete`/`timezone` through unchanged.

- [ ] **Step 1: Add `.side-panel` CSS**

Add right after the existing `dialog.modal`/`::backdrop`/`[open]`/`@keyframes modal-in` block in `globals.css`:

```css
dialog.side-panel {
  margin: 0 0 0 auto;
  width: min(28rem, 100vw);
  height: 100dvh;
  max-height: 100dvh;
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-lg);
  padding: 0;
  border: none;
  border-left: 1px solid var(--line);
  display: flex;
  flex-direction: column;
}
dialog.side-panel::backdrop {
  background: var(--overlay);
  backdrop-filter: blur(2px);
}
dialog.side-panel[open] {
  animation: panel-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes panel-in {
  from { opacity: 0; transform: translateX(16px); }
  to { opacity: 1; transform: none; }
}
```

- [ ] **Step 2: Replace `Modal` with a local `<dialog>` in `card-modal.tsx`**

Remove `import { Modal } from "@/components/ui/modal";`. Add `useRef` to the existing `useEffect`/`useState` import. Add a `ref = useRef<HTMLDialogElement>(null)` and a `useEffect` that calls `ref.current.showModal()`/`.close()` on `open` changes — copy this lifecycle exactly from `src/components/ui/modal.tsx`'s own `useEffect` (lines 20-25), so Escape-to-close and the native backdrop both keep working (covers Review Focus item 5). The outer JSX becomes:

```tsx
<dialog ref={ref} className="side-panel" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
  {open && (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-line p-5">
        <h2 className="text-lg font-semibold">{w.cardDetailTitle}</h2>
        <button type="button" className="icon-btn icon-btn-plain" onClick={onClose} aria-label={t.common.close}>
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="grid gap-4 overflow-y-auto p-5">{/* existing form fields, reordered per Step 4 */}</div>
      <div className="flex items-center justify-between gap-3 border-t border-line p-5">{/* existing footer buttons, unchanged */}</div>
    </>
  )}
</dialog>
```

- [ ] **Step 3: Type-check after the shell change**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Add `startDate` state and wiring**

- `SerializedCard` gains `startDate: string | null`.
- New state: `const [startDate, setStartDate] = useState("");`.
- In the card-load `useEffect`, add `setStartDate(card.startDate ? utcToZonedDateTimeInput(new Date(card.startDate), timezone) : "");` next to the existing `setDueDate(...)` line.
- In `saveInfo()`, add `startDate: startDate || undefined` to the `updateWorkCard` payload, next to `dueDate`.
- Move the existing "Timeline" field (currently just the `w.cardDue` label/input) into a two-column row with a new `startDate` input (`type="datetime-local"`, label `w.startDateLabel`), under a new `<p className="label mb-2">{w.timelineTitle}</p>` heading. Relabel the section containing `AssigneePicker`/team select with a `w.peopleTitle` heading above it (no behavior change). Relabel the `cardLabel` field's section as `w.typeTitle` for display only (still bound to `label`/`setLabel`, still the same input).

- [ ] **Step 5: Add attachment state, load, and render**

- New state: `attachments`, `newAttachmentUrl`, `newAttachmentLabel`.
- In the card-load `useEffect`, call `listWorkCardAttachments(card.id).then((res) => { if (res.ok) setAttachments(res.data); });` alongside the existing comments load.
- New section after Subtasks, before Comments:
  ```tsx
  <div>
    <p className="label mb-2">{w.attachmentsTitle}</p>
    {attachments.length === 0 ? (
      <p className="text-sm text-muted">{w.attachmentsEmpty}</p>
    ) : (
      <ul className="space-y-1.5">
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center gap-2">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-accent underline">
              {a.label || a.url}
            </a>
            {!locked && (
              <button type="button" className="icon-btn icon-btn-plain size-6 shrink-0" onClick={() => removeAttachment(a.id)} aria-label={w.deleteCardBtn}>
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
    )}
    {!locked && (
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input className="input flex-1" value={newAttachmentUrl} onChange={(e) => setNewAttachmentUrl(e.target.value)} placeholder={w.attachmentUrlPh} maxLength={2000} />
        <input className="input flex-1" value={newAttachmentLabel} onChange={(e) => setNewAttachmentLabel(e.target.value)} placeholder={w.attachmentLabelPh} maxLength={80} />
        <button type="button" className="btn btn-soft" onClick={addAttachment}>{w.attachmentAdd}</button>
      </div>
    )}
  </div>
  ```
  with handlers:
  ```ts
  const addAttachment = () => {
    const url = newAttachmentUrl.trim();
    if (!url) return;
    exec(() => addWorkCardAttachment(card.id, { url, label: newAttachmentLabel.trim() || undefined }), {
      success: w.attachmentAdded,
      onSuccess: () => {
        setNewAttachmentUrl("");
        setNewAttachmentLabel("");
        listWorkCardAttachments(card.id).then((res) => { if (res.ok) setAttachments(res.data); });
      },
    });
  };
  const removeAttachment = (id: string) => {
    exec(() => deleteWorkCardAttachment(id), {
      success: w.attachmentDeleted,
      onSuccess: () => setAttachments((prev) => prev.filter((a) => a.id !== id)),
    });
  };
  ```
  The `!locked` guards on both the delete button and the add-form match the existing checklist section's own `!locked` guards exactly — covers Review Focus item 3 for attachments.

- [ ] **Step 6: Add per-subtask description field**

In the checklist `<li>` (currently a single flex row), add a second line below the existing title row: a small text input bound to `item.description ?? ""`, `placeholder={w.subtaskDescriptionPh}`, `disabled={locked}`. On `onChange`, update local `checklist` state directly (`setChecklist(checklist.map((i) => (i.id === item.id ? { ...i, description: e.target.value || undefined } : i)))`) so typing feels instant with no server round-trip per keystroke. On `onBlur`, call `persistChecklist(checklist)` (the already-updated state) to save — the same split `toggleItem`/`removeItem` already get for free by calling `persistChecklist` directly, just deferred to blur here since this field is free text.

- [ ] **Step 7: Type-check and build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: both PASS.

- [ ] **Step 8: Manual Playwright verification (golden path + Review Focus items)**

Against a real board with at least one unlocked card and one card in the Done list (locked for a non-owner view, if testable; otherwise note it was checked by reading the code path):
1. Click a card in Kanban — panel slides in from the right (not a centered popup); click the backdrop — panel closes; reopen, press Escape — panel closes. (Review Focus 5)
2. Set a start date and a due date, save, close, reopen — both show the same local date/time back. (Review Focus 4)
3. Add a description to a subtask, save (blur), reopen — description persisted.
4. Add an attachment (valid URL + label) — appears in the list; open it — correct URL in a new tab; delete it — disappears.
5. Add 10 attachments, then try an 11th — blocked with the `attachmentLimitReached` toast, not silently accepted. (Review Focus 1)
6. Try submitting an empty/invalid URL in the attachment form — rejected before anything is added. (Review Focus 2)
7. Open the same card from the Table view and from the Calendar view (Phase 1's `WorkTableView`/`WorkCalendarView`) — same panel opens correctly in both, confirming no regression from the shared `CardModal` signature staying the same.
8. If a Done-list card viewed as a non-owner is available: confirm the attachment add-form and subtask description inputs are both disabled/hidden, matching the existing locked behavior. (Review Focus 3)

Record pass/fail for each; fix forward before moving on.

- [ ] **Step 9: Commit**

```bash
git add src/app/globals.css "src/app/(app)/workspace/card-modal.tsx"
git commit -m "feat(workspace): replace card modal with a right-side panel, add Timeline/People labels, subtask descriptions, and link attachments"
```
