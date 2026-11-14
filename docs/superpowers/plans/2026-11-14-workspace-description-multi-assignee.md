# Mô tả công việc + nhiều người phụ trách ngang hàng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a short "Mô tả" field to work cards, and replace the single
`assigneeUserId` with a many-to-many set of equally-responsible assignees
where every co-assignee gets full, independent discipline scoring.

**Architecture:** Two independent slices sharing one schema migration
window. Slice A (Mô tả) is a plain passthrough field. Slice B
(multi-assignee) replaces `WorkCard.assignee`/`assigneeUserId` with a new
`WorkCardAssignee` join table, threads that set through permission checks
(`canActOnCard`), the pooled-view query (`getAccessibleBoards`), the
discipline scoring ledger (per-person idempotency keys and per-person
"assigned at" lookups), and the card UI (multi-select picker, avatar
stack). The schema changes land in two `prisma db push` passes: an
additive pass first (new table/columns, old ones untouched) so a backfill
script can read the old single-assignee columns before anything drops
them, then a destructive pass once all code has moved off those columns.

**Tech Stack:** Next.js App Router, Prisma/Postgres, Zod, `tsx --test` for
pure-function unit tests (this repo's existing convention — DB-touching
server actions and server components are verified manually via the dev
server + Playwright, not unit tests; follow that same split here).

**Spec:** `docs/superpowers/specs/2026-11-14-workspace-description-multi-assignee-design.md`

## Global Constraints

- Mỗi người phụ trách khi thẻ hoàn thành đúng/sớm hạn hoặc trễ hạn nhận đủ
  **100%** điểm thưởng/phạt — không chia nhỏ theo số người (spec Goals).
- Đổi người/team phụ trách vẫn là quyền riêng của chủ bảng; người được cấp
  quyền chỉ xem/sửa nội dung-tiến độ (spec Goals, giữ nguyên nguyên tắc
  hiện tại — `canActOnCard`/`isBoardOwner` trong `src/actions/work.ts`).
- Không chia vai trò khác nhau giữa các người phụ trách — tất cả ngang
  hàng (spec Non-goals).
- Không đổi cách gắn team phụ trách (`teamId`, 1 team/thẻ) và không đổi
  `WorkBoard.assignee`/`assigneeUserId` (spec Non-goals) — chỉ `WorkCard`
  đổi.
- Không truy tính lại điểm cho thẻ đã đóng khi sau này đổi danh sách
  người phụ trách; các `DisciplineTransaction` cũ giữ nguyên (spec
  Non-goals/Anti-goals).
- Mốc "được giao lúc nào" của một người, khi không tìm thấy sự kiện lịch
  sử nào ghi nhận họ, là thời điểm của chính sự kiện đang xử lý ("ngay bây
  giờ") — **không** còn fallback về `card.createdAt` (spec, quyết định
  sau builder check).
- **Không** backfill `WorkCardEvent.fromAssigneeUserId`/`toAssigneeUserId`
  cũ sang mảng mới trước khi xoá cột — chấp nhận lịch sử "được giao từ khi
  nào" của thẻ cũ reset (spec, quyết định sau builder check).
- Mọi `prisma db push` cần xin xác nhận lại ngay trước khi chạy (quy ước
  đã thiết lập trong session này).
- Copy UI mới đi qua `src/lib/i18n/vi.ts`/`en.ts`, không hardcode chuỗi
  (quy ước đã thiết lập trong session này).

## Review Focus

- Một người phụ trách chỉ nhập bằng email, chưa có tài khoản Nội Tại Ẩn
  khớp — không được tính điểm/không được thông báo, nhưng không được chặn
  việc tính điểm cho NHỮNG người khác cùng phụ trách thẻ đó. → Task 4, 6.
- Một thẻ không còn ai phụ trách (xoá hết, hoặc chưa từng gán ai) — các
  đường tính quyền/tính điểm phải no-op sạch sẽ, không được throw. → Task
  4, 5.
- Người đang thao tác (vd. chủ bảng) cũng nằm trong danh sách phụ trách —
  không bị thông báo trùng cho chính họ, nhưng vẫn được tính điểm bình
  thường như người khác. → Task 6.
- Nhập trùng 1 email 2 lần, hoặc vượt số người phụ trách tối đa cho phép —
  bị từ chối rõ ràng ở tầng validate, không tạo 2 dòng trùng và không rơi
  vào lỗi vi phạm ràng buộc unique của DB. → Task 6.
- Hai người cùng phụ trách 1 thẻ nhưng journey của họ đặt múi giờ khác
  nhau — mỗi người phải được tính điểm theo đúng múi giờ của **chính họ**,
  độc lập với người kia (logiphiên bản đơn hiện tại đã làm vậy cho 1
  người; vòng lặp nhiều người phải giữ đúng tính chất này). → Task 4.

---

## File Structure

- `prisma/schema.prisma` — modify: `WorkCard` (thêm `description`, sau đó
  bỏ `assignee`/`assigneeUserId`), model mới `WorkCardAssignee`,
  `WorkCardEvent` (thêm `fromAssigneeIds`/`toAssigneeIds` Json, sau đó bỏ
  `fromAssigneeUserId`/`toAssigneeUserId`).
- `scripts/backfill-work-card-assignees.ts` — create: script một lần,
  chuyển dữ liệu `WorkCard.assignee`/`assigneeUserId` cũ sang bảng
  `WorkCardAssignee`.
- `src/lib/journey-scoring.ts` — modify: `workspaceScoreIdempotencyKey`
  thêm tham số `userId`.
- `src/lib/journey-scoring.test.ts` — modify: cập nhật test theo chữ ký
  mới + thêm test phân biệt theo `userId`.
- `src/lib/journey-score-ledger.ts` — modify: `recordWorkCardScoreEvent`
  nhận mảng người phụ trách thay vì 1 người, tính điểm lặp từng người;
  `syncOverdueDiscipline` đổi điều kiện truy vấn.
- `src/lib/work-types.ts` — modify: thêm type `CardAssignee` dùng chung.
- `src/lib/work-queries.ts` — modify: `getAccessibleBoards`'s cardGrant
  + select đổi theo quan hệ `assignees`; card select thêm `description`.
- `src/actions/work.ts` — modify: `canActOnCard`, `cardSchema`
  (`assignees: string[]`, `description`), `createWorkCard`,
  `updateWorkCard`, `moveWorkCard`, và mọi select/`canActOnCard` call site
  còn lại (`updateWorkCardChecklist`, `reorderWorkCards`,
  `listWorkCardComments`, `addWorkCardComment`, `listWorkCardAttachments`,
  `addWorkCardAttachment`, `deleteWorkCardAttachment`).
- `src/components/ui/avatar-stack.tsx` — create: hiển thị nhiều `Avatar`
  xếp chồng, tối đa N cái + "+N dư".
- `src/app/(app)/workspace/assignee-picker.tsx` — modify: thêm component
  mới `AssigneesPicker` (nhiều người), giữ nguyên `AssigneePicker` (1
  người, bảng vẫn dùng).
- `src/app/(app)/workspace/card-modal.tsx` — modify: `SerializedCard`
  (`description`, `assignees: CardAssignee[]` thay `assignee`), ô mô tả,
  `AssigneesPicker`.
- `src/app/(app)/workspace/new-task-button.tsx` — modify: ô mô tả,
  `AssigneesPicker`.
- `src/app/(app)/workspace/work-list-view.tsx` — modify: cột "Mô tả" mới,
  cột "Phụ trách" dùng `AvatarStack`.
- `src/app/(app)/workspace/kanban-board.tsx` — modify: `CardBody` thêm
  dòng mô tả rút gọn + `AvatarStack`.
- `src/app/(app)/workspace/page.tsx` — modify: map `description`,
  `assignees` vào `SerializedCard` khi gộp (`poolListsByName`).
- `src/lib/i18n/vi.ts` / `en.ts` — modify: thêm các khoá mới (xem từng
  task).

---

### Task 1: Schema (phần thêm, không xoá gì)

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: model `WorkCardAssignee { id, cardId, email, userId?, createdAt }`
  (unique `(cardId, email)`, index trên `userId`); `WorkCard.description
  String?`; `WorkCardEvent.fromAssigneeIds Json @default("[]")`,
  `WorkCardEvent.toAssigneeIds Json @default("[]")`. Các cột/field cũ
  (`WorkCard.assignee`, `WorkCard.assigneeUserId`,
  `WorkCardEvent.fromAssigneeUserId`, `WorkCardEvent.toAssigneeUserId`)
  **giữ nguyên**, chưa đụng tới trong task này.

- [ ] **Step 1: Thêm model `WorkCardAssignee` vào `prisma/schema.prisma`**

```prisma
model WorkCardAssignee {
  id        String   @id @default(cuid())
  cardId    String
  email     String
  userId    String?
  createdAt DateTime @default(now())

  card WorkCard @relation(fields: [cardId], references: [id], onDelete: Cascade)
  user User?    @relation("WorkCardAssigneeUser", fields: [userId], references: [id], onDelete: SetNull)

  @@unique([cardId, email])
  @@index([userId])
}
```

Thêm quan hệ ngược `assignees WorkCardAssignee[]` vào `model WorkCard`, và
`workCardAssignees WorkCardAssignee[] @relation("WorkCardAssigneeUser")`
vào `model User`.

- [ ] **Step 2: Thêm `description String?` vào `model WorkCard`**

- [ ] **Step 3: Thêm `fromAssigneeIds Json @default("[]")` và
      `toAssigneeIds Json @default("[]")` vào `model WorkCardEvent`**
      (song song với 2 cột cũ, chưa xoá cột cũ)

- [ ] **Step 4: Xin xác nhận người dùng rồi chạy `npx prisma db push`, sau
      đó `npx prisma generate`**

- [ ] **Step 5: `npx tsc --noEmit` để chắc chắn không có chỗ nào vỡ build
      (task này chỉ thêm, không xoá, nên phải sạch)**

Expected: không lỗi.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(workspace): add WorkCardAssignee table, card description, assignee-id snapshot arrays (additive)"
```

---

### Task 2: Mô tả công việc (Slice A — độc lập với multi-assignee)

**Files:**
- Modify: `src/actions/work.ts` (`cardSchema`, `createWorkCard`,
  `updateWorkCard`)
- Modify: `src/app/(app)/workspace/card-modal.tsx`
- Modify: `src/app/(app)/workspace/new-task-button.tsx`
- Modify: `src/app/(app)/workspace/work-list-view.tsx`
- Modify: `src/app/(app)/workspace/kanban-board.tsx`
- Modify: `src/app/(app)/workspace/page.tsx`
- Modify: `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `WorkCard.description` (Task 1).
- Produces: `SerializedCard.description: string | null` (card-modal.tsx) —
  dùng bởi Task 8's UI cũng đọc field này, không đổi tên về sau.

- [ ] **Step 1: Thêm `description` vào `cardSchema` trong `src/actions/work.ts`**

```ts
description: z.string().trim().max(2000).optional().transform((v) => v || null),
```

Thêm field này vào `cardSchema` (dùng chung cho `createWorkCard` và
`updateWorkCard` qua `cardUpdateSchema = cardSchema`). Truyền
`data.description` vào `tx.workCard.create`/`tx.workCard.update`.

- [ ] **Step 2: Thêm `description: string | null` vào `SerializedCard`
      (`card-modal.tsx`), khởi tạo state `description` từ `card.description`
      trong effect load, gửi lên `updateWorkCard` trong `saveInfo()`**

- [ ] **Step 3: Thêm ô `<textarea>` Mô tả trong `card-modal.tsx`, ngay
      dưới ô Tiêu đề, trước khối "Cột/Mức độ"** — `maxLength={2000}`,
      3 dòng, `disabled={locked}`.

- [ ] **Step 4: Thêm state + ô `<textarea>` Mô tả tương tự trong
      `new-task-button.tsx`, gửi `description` vào `createWorkCard`**

- [ ] **Step 5: Thêm cột "Mô tả" vào `work-list-view.tsx`** — giữa cột
      "Tiêu đề" và "Phụ trách" (khớp đúng thứ tự ảnh mẫu), rút gọn 1 dòng
      (`className="truncate max-w-xs"` hoặc tương đương), hiện `card.description
      || "—"`.

- [ ] **Step 6: Thêm dòng mô tả rút gọn (1-2 dòng, `line-clamp-2`) dưới
      tiêu đề trong `CardBody` (`kanban-board.tsx`)**, chỉ render khi
      `card.description` khác null.

- [ ] **Step 7: Map `description: card.description` vào `SerializedCard`
      khi gộp trong `page.tsx` (`poolListsByName`'s card mapping)**

- [ ] **Step 8: Thêm i18n keys vào `vi.ts`/`en.ts`**: `cardDescription`
      ("Mô tả công việc" / "Description"), `cardDescriptionPh` ("Thêm mô
      tả ngắn cho việc này…" / "Add a short description…"),
      `colDescription` ("Mô tả" / "Description").

- [ ] **Step 9: Xác minh thủ công qua dev server + Playwright** — tạo 1
      thẻ mới có mô tả, mở lại card-modal xác nhận còn nguyên, xác nhận
      cột "Mô tả" hiện ở List view và dòng mô tả hiện ở Kanban.

- [ ] **Step 10: `npx tsc --noEmit` và `npm test` (suite hiện có phải vẫn
      32/32)**

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(workspace): add a short description field to work cards"
```

---

### Task 3: Backfill dữ liệu người phụ trách cũ sang bảng mới

**Files:**
- Create: `scripts/backfill-work-card-assignees.ts`

**Interfaces:**
- Consumes: `WorkCard.assignee`/`assigneeUserId` (cột cũ, vẫn còn nguyên
  sau Task 1), model `WorkCardAssignee` (Task 1).
- Produces: dữ liệu thật trong bảng `WorkCardAssignee` — Task 6 giả định
  bảng này đã có đủ dữ liệu cho mọi thẻ cũ trước khi code chuyển hẳn sang
  đọc từ nó.

- [ ] **Step 1: Viết script `scripts/backfill-work-card-assignees.ts`**

```ts
import { db } from "../src/lib/db";

async function main() {
  const cards = await db.workCard.findMany({
    where: { assignee: { not: null } },
    select: { id: true, assignee: true, assigneeUserId: true },
  });
  let created = 0;
  for (const card of cards) {
    await db.workCardAssignee.upsert({
      where: { cardId_email: { cardId: card.id, email: card.assignee! } },
      create: { cardId: card.id, email: card.assignee!, userId: card.assigneeUserId },
      update: {},
    });
    created++;
  }
  console.log(`Backfilled ${created} / ${cards.length} card assignees`);
}

main().finally(() => db.$disconnect());
```

(Tên trường unique trong `where` theo đúng tên Prisma sinh ra cho
`@@unique([cardId, email])` — kiểm tra lại tên chính xác trong client đã
generate ở Task 1, Prisma thường đặt là `cardId_email`.)

- [ ] **Step 2: Xin xác nhận người dùng rồi chạy `npx tsx scripts/backfill-work-card-assignees.ts`**

- [ ] **Step 3: Xác minh bằng 1 truy vấn đếm** —
      `npx tsx -e "import {db} from './src/lib/db'; db.workCardAssignee.count().then(console.log).finally(()=>db.$disconnect())"`
      và so với số thẻ có `assignee` khác null (lệnh tương tự với
      `db.workCard.count({where:{assignee:{not:null}}})`) — hai số phải
      bằng nhau.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-work-card-assignees.ts
git commit -m "chore(workspace): backfill existing single assignees into WorkCardAssignee"
```

---

### Task 4: Sổ tính điểm kỷ luật — khoá chống trùng theo người, tính điểm từng người

**Files:**
- Modify: `src/lib/journey-scoring.ts`
- Modify: `src/lib/journey-scoring.test.ts`
- Modify: `src/lib/journey-score-ledger.ts`

**Interfaces:**
- Consumes: `WorkCardEvent.toAssigneeIds`/`fromAssigneeIds` (Json array,
  Task 1).
- Produces: `workspaceScoreIdempotencyKey(cardId: string, code:
  WorkspaceScoreCode, localDate: string, userId: string): string`;
  `recordWorkCardScoreEvent(tx, input)` với `input.fromAssigneeIds:
  string[]` và `input.toAssigneeIds: string[]` thay cho
  `fromAssigneeUserId`/`toAssigneeUserId` đơn — Task 6 gọi hàm này bằng
  2 mảng đó.
  `syncOverdueDiscipline(userId: string, throughAt?: Date): Promise<number>`
  giữ nguyên chữ ký, chỉ đổi bên trong.

- [ ] **Step 1: Viết test thất bại cho `workspaceScoreIdempotencyKey` có
      thêm `userId`** trong `src/lib/journey-scoring.test.ts`

```ts
test("workspaceScoreIdempotencyKey differs by userId for the same card/code/date", () => {
  assert.notEqual(
    workspaceScoreIdempotencyKey("card-1", "WORK_OVERDUE_FIRST_DAY", "2026-11-05", "user-a"),
    workspaceScoreIdempotencyKey("card-1", "WORK_OVERDUE_FIRST_DAY", "2026-11-05", "user-b"),
  );
});
```

- [ ] **Step 2: Chạy `npx tsx --test src/lib/journey-scoring.test.ts`,
      xác nhận FAIL** (thiếu tham số thứ 4 / lỗi kiểu)

- [ ] **Step 3: Sửa `workspaceScoreIdempotencyKey` thêm tham số `userId:
      string`, nối vào cuối mọi nhánh chuỗi trả về** (vd.
      `` `workcard:${cardId}:${userId}:completion-reward` ``, tương tự cho
      3 nhánh còn lại). Sửa 2 lời gọi cũ trong
      `journey-scoring.test.ts` (dòng ~143-148) thêm tham số `userId` giả
      lập.

- [ ] **Step 4: Chạy lại test, xác nhận PASS, và `npm test` toàn bộ suite
      vẫn xanh**

- [ ] **Step 5: Đổi `WorkCardScoreEventInput` trong
      `journey-score-ledger.ts`**: bỏ `fromAssigneeUserId`/
      `toAssigneeUserId: string | null`, thay bằng `fromAssigneeIds:
      string[]` và `toAssigneeIds: string[]`.

- [ ] **Step 6: Sửa `recordWorkCardScoreEvent`**:
      - `tx.workCardEvent.create`'s data dùng
        `fromAssigneeIds: input.fromAssigneeIds, toAssigneeIds:
        input.toAssigneeIds` (Prisma `Json` field nhận mảng string trực
        tiếp).
      - Thay khối "nếu không completedNow/không có toAssigneeUserId thì
        return" bằng: nếu không `completedNow` thì return; nếu
        `input.toAssigneeIds.length === 0` thì return (không ai để tính
        điểm).
      - Lặp `for (const userId of input.toAssigneeIds)`, với MỖI người:
        tìm `journey` riêng của họ (where `userId`), nếu không có
        journey active thì bỏ qua người đó (không return sớm toàn hàm —
        người khác vẫn phải được xét).
      - `assignedAt` cho từng người: tìm `WorkCardEvent` gần nhất (trước
        sự kiện hiện tại, `id: { not: event.id }`, loại
        `CARD_CREATED`/`ASSIGNEE_CHANGED`) mà **mảng JSON
        `toAssigneeIds` chứa `userId` này** — dùng Prisma filter
        `toAssigneeIds: { array_contains: userId }` trên cột Json (xác
        nhận cú pháp đúng với provider Postgres khi code — đây là chi
        tiết triển khai). Nếu không tìm thấy, `assignedAt = event.occurredAt`
        (KHÔNG fallback về `input.createdAt` — constraint đã ghi ở đầu
        plan).
      - Gọi `createDisciplineEntries` + tính `scoreOverdueDays` y hệt
        logic cũ nhưng cho từng `userId` trong vòng lặp, dùng đúng
        `journey.timezone`/`rules` của chính người đó (không dùng chung 1
        timezone cho cả nhóm — Review Focus "múi giờ khác nhau").

- [ ] **Step 7: Sửa `syncOverdueDiscipline(userId, throughAt)`**: đổi
      `db.workCard.findMany({where: {assigneeUserId: userId, ...}})`
      thành `where: { assignees: { some: { userId } }, ... }`.

- [ ] **Step 8: `npx tsc --noEmit`** — kỳ vọng lỗi xuất hiện Ở các nơi
      GỌI `recordWorkCardScoreEvent`/`workspaceScoreIdempotencyKey`
      trong `src/actions/work.ts` (đúng, vì Task 5/6 chưa sửa — ghi nhận
      đây là lỗi tạm thời, sẽ hết sau Task 6, không phải lỗi của task
      này).

- [ ] **Step 9: Commit**

```bash
git add src/lib/journey-scoring.ts src/lib/journey-scoring.test.ts src/lib/journey-score-ledger.ts
git commit -m "feat(workspace): score every co-assignee independently with per-user idempotency keys"
```

---

### Task 5: Quyền thao tác thẻ + truy vấn bảng accessible theo nhiều người phụ trách

**Files:**
- Modify: `src/actions/work.ts` (`canActOnCard` + mọi select dùng nó)
- Modify: `src/lib/work-queries.ts` (`getAccessibleBoards`)
- Modify: `src/lib/work-types.ts` (thêm `CardAssignee`)

**Interfaces:**
- Consumes: quan hệ `WorkCard.assignees` (Task 1/3).
- Produces: `canActOnCard(card: { assignees: { userId: string | null
  }[]; teamId: string | null; list: { board: { userId: string } } },
  userId: string, userTeamIds: string[]): boolean` — Task 6 dùng đúng
  shape này cho mọi `select`. `getAccessibleBoards` trả về mỗi card kèm
  `assignees: CardAssignee[]` và `description: string | null`.
  `CardAssignee = { email: string; userId: string | null; name: string |
  null }` (`work-types.ts`).

- [ ] **Step 1: Thêm `export type CardAssignee = { email: string; userId:
      string | null; name: string | null };` vào `src/lib/work-types.ts`**

- [ ] **Step 2: Sửa `canActOnCard` trong `src/actions/work.ts`**

```ts
function canActOnCard(
  card: { assignees: { userId: string | null }[]; teamId: string | null; list: { board: { userId: string } } },
  userId: string,
  userTeamIds: string[],
) {
  return isBoardOwner(card.list.board, userId) || card.assignees.some((a) => a.userId === userId) || (!!card.teamId && userTeamIds.includes(card.teamId));
}
```

- [ ] **Step 3: Đổi mọi `select` đang lấy `assigneeUserId: true` cho
      `canActOnCard` thành `assignees: { select: { userId: true } }`** —
      các hàm: `updateWorkCardChecklist`, `reorderWorkCards`,
      `listWorkCardComments`, `addWorkCardComment`,
      `listWorkCardAttachments`, `addWorkCardAttachment`,
      `deleteWorkCardAttachment` (giữ nguyên các field khác trong từng
      select, chỉ đổi riêng field phụ trách).

- [ ] **Step 4: Sửa `addWorkCardComment`'s notify logic** — đổi
      `if (card.assigneeUserId && card.assigneeUserId !== user.id)
      notifyIds.add(card.assigneeUserId);` thành lặp
      `for (const a of card.assignees) if (a.userId && a.userId !==
      user.id) notifyIds.add(a.userId);` (select của hàm này cũng đổi
      theo Step 3).

- [ ] **Step 5: Sửa `getAccessibleBoards` trong `src/lib/work-queries.ts`**
      — `cardGrant` đổi từ `{ assigneeUserId: userId }` thành `{
      assignees: { some: { userId } } }`; thêm vào `include`/`select`
      của `cards`: `description: true`, và
      `assignees: { select: { email: true, userId: true, user: { select:
      { name: true } } } }`; map kết quả về đúng shape `CardAssignee[]`
      (`{ email, userId, name: a.user?.name ?? null }`) trước khi trả.
      Với board không-owner, `lists.map(... cards: l.cards.filter(...))`
      giữ nguyên lọc theo `c.assigneeUserId === userId` cũ → đổi thành
      `c.assignees.some(a => a.userId === userId)`.

- [ ] **Step 6: `npx tsc --noEmit`** — kỳ vọng lỗi còn lại chỉ ở
      `createWorkCard`/`updateWorkCard`/`moveWorkCard`/`page.tsx`'s
      mapping (Task 6/2 xử lý), không còn lỗi ở các hàm vừa sửa.

- [ ] **Step 7: Commit**

```bash
git add src/actions/work.ts src/lib/work-queries.ts src/lib/work-types.ts
git commit -m "feat(workspace): switch permission checks and the pooled-board query to multi-assignee"
```

---

### Task 6: Tạo/sửa/di chuyển thẻ với nhiều người phụ trách

**Files:**
- Modify: `src/actions/work.ts` (`cardSchema`, `createWorkCard`,
  `updateWorkCard`, `moveWorkCard`)
- Modify: `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `recordWorkCardScoreEvent` shape mới (Task 4),
  `canActOnCard` shape mới (Task 5).
- Produces: `CardInput.assignees: string[]` (thay `assignee: string`) —
  Task 8's UI gửi lên đúng field này.

- [ ] **Step 1: Đổi `cardSchema` trong `src/actions/work.ts`** — bỏ
      `assignee: z.string()...`, thêm:

```ts
assignees: z
  .array(z.string().trim().toLowerCase().email().max(160))
  .max(10)
  .default([])
  .transform((arr) => [...new Set(arr)]),
```

(Giới hạn 10 người/thẻ, de-dupe email trùng — Review Focus "nhập trùng
email".)

- [ ] **Step 2: Viết hàm nội bộ `resolveAssigneeIds(emails: string[]):
      Promise<{ email: string; userId: string | null }[]>`** trong
      `work.ts`, dùng `db.user.findMany({ where: { email: { in: emails }
      } }, select: { id: true, email: true })` rồi map từng email sang
      `userId` khớp hoặc `null`.

- [ ] **Step 3: Sửa `createWorkCard`** — bỏ `resolveAssigneeId`/
      `assigneeUserId` đơn; dùng `resolveAssigneeIds(data.assignees)`;
      trong transaction, sau khi tạo `card`, `createMany` các
      `WorkCardAssignee` tương ứng (`cardId: card.id, email, userId`);
      gọi `recordWorkCardScoreEvent` với `fromAssigneeIds: [],
      toAssigneeIds: resolved.map(r => r.userId).filter((id): id is
      string => !!id)`. Sau transaction: `syncOverdueDiscipline` cho
      từng userId đã khớp; gửi thông báo cho từng assignee đã khớp (viết
      lại `notifyAssignee` thành `notifyAssignees(resolved, user,
      title)` lặp từng người, bỏ qua người trùng `user.id` — giữ nguyên
      nội dung thông báo cũ, chỉ lặp).

- [ ] **Step 4: Sửa `updateWorkCard`** — `select` đổi
      `assignees: { select: { email: true, userId: true } }` thay
      `assignee`/`assigneeUserId`; chỉ chủ bảng (`isOwner`) được đổi
      danh sách phụ trách (giữ nguyên nguyên tắc cũ); tính
      `nextResolved = isOwner ? await resolveAssigneeIds(data.assignees)
      : card.assignees` (giữ nguyên nếu không phải chủ bảng); diff theo
      **email**: `added = nextResolved.filter(n => !card.assignees.some(c
      => c.email === n.email))`, `removed = card.assignees.filter(c =>
      !nextResolved.some(n => n.email === c.email))`; trong transaction:
      xoá các `WorkCardAssignee` trong `removed` (`deleteMany({where:
      {cardId: id, email: {in: removed.map(r=>r.email)}}})`),
      `createMany` các `added`; gọi `recordWorkCardScoreEvent` với
      `fromAssigneeIds`/`toAssigneeIds` là `userId` đã khớp của
      `card.assignees`/`nextResolved` tương ứng (lọc `null`).
      `assigneeChanged = isOwner && (added.length > 0 || removed.length
      > 0)` (thay `data.assignee !== card.assignee` cũ). Sau transaction:
      `syncOverdueDiscipline` cho mọi userId trong `nextResolved` (không
      chỉ 1 người); `syncJourneyAchievements` cho mọi userId đã khớp khi
      `completedNow`; thông báo **chỉ** cho `added` đã khớp tài khoản
      (Review Focus "chủ bảng cũng là người phụ trách" — bỏ qua nếu
      `userId === user.id`).

- [ ] **Step 5: Sửa `moveWorkCard`** — `select` đổi sang
      `assignees: { select: { userId: true } }`; vì hàm này không đổi
      người phụ trách, `fromAssigneeIds = toAssigneeIds =
      card.assignees.map(a => a.userId).filter((id): id is string =>
      !!id)`; `syncOverdueDiscipline`/`syncJourneyAchievements` lặp qua
      mảng đó thay vì gọi 1 lần cho `card.assigneeUserId`.

- [ ] **Step 6: Thêm i18n keys cho giới hạn mới** (vd.
      `cardAssigneeLimit`: "Tối đa 10 người phụ trách mỗi việc" / "Up to
      10 people per task") nếu muốn hiện lỗi UserError thân thiện khi
      vượt — builder tự quyết định có cần thông điệp riêng hay dùng lỗi
      validate chung.

- [ ] **Step 7: `npx tsc --noEmit`** — kỳ vọng lỗi còn lại chỉ ở
      `card-modal.tsx`/`new-task-button.tsx`/`page.tsx`/
      `work-list-view.tsx`/`kanban-board.tsx` (Task 8 xử lý UI; `page.tsx`
      đã xử lý phần `description` ở Task 2, còn phần `assignees` mapping
      vẫn chờ Task 8).

- [ ] **Step 8: Commit**

```bash
git add src/actions/work.ts src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "feat(workspace): create/update/move cards with an equal multi-assignee set"
```

---

### Task 7: Schema (phần xoá) — bỏ các cột người-phụ-trách-đơn cũ

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: không còn nơi nào trong `src/` đọc/ghi
  `WorkCard.assignee`/`assigneeUserId` hay
  `WorkCardEvent.fromAssigneeUserId`/`toAssigneeUserId` (xác nhận ở Step
  1 trước khi xoá).

- [ ] **Step 1: Grep xác nhận không còn tham chiếu nào tới
      `assigneeUserId`/`WorkCard.assignee`/`fromAssigneeUserId`/
      `toAssigneeUserId` trong `src/` ngoài chính `schema.prisma`** —
      nếu còn, dừng lại và quay lại Task 5/6 xử lý nốt trước khi tiếp
      tục task này.

- [ ] **Step 2: Xoá `assignee`, `assigneeUserId`, và field quan hệ
      `assigneeUser User? @relation("WorkCardAssignee", ...)` khỏi
      `model WorkCard`; xoá `fromAssigneeUserId`, `toAssigneeUserId`
      khỏi `model WorkCardEvent`; xoá dòng quan hệ ngược
      `assignedWorkCards WorkCard[] @relation("WorkCardAssignee")` khỏi
      `model User`** (tên quan hệ cũ `"WorkCardAssignee"` — không phải
      tên quan hệ mới `"WorkCardAssigneeUser"` của bảng
      `WorkCardAssignee`, Task 1 — giữ nguyên quan hệ mới đó).

- [ ] **Step 3: Xin xác nhận người dùng rồi chạy `npx prisma db push`,
      sau đó `npx prisma generate`**

- [ ] **Step 4: `npx tsc --noEmit` và `npm test`** — kỳ vọng sạch hoàn
      toàn (không còn lỗi nào, vì Step 1 đã xác nhận trước).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(workspace): drop the single-assignee columns now that cards use WorkCardAssignee"
```

---

### Task 8: Giao diện chọn nhiều người phụ trách + avatar xếp chồng

**Files:**
- Create: `src/components/ui/avatar-stack.tsx`
- Modify: `src/app/(app)/workspace/assignee-picker.tsx`
- Modify: `src/app/(app)/workspace/card-modal.tsx`
- Modify: `src/app/(app)/workspace/new-task-button.tsx`
- Modify: `src/app/(app)/workspace/work-list-view.tsx`
- Modify: `src/app/(app)/workspace/kanban-board.tsx`
- Modify: `src/app/(app)/workspace/page.tsx`
- Modify: `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `CardAssignee` (Task 5), `CardInput.assignees: string[]`
  (Task 6).
- Produces: `AvatarStack({ people, max = 3 }: { people: { name: string;
  image?: string | null }[]; max?: number })` (component dùng chung);
  `AssigneesPicker({ value, onChange, members, placeholder, disabled }:
  { value: string[]; onChange: (v: string[]) => void; members:
  MemberOption[]; placeholder?: string; disabled?: boolean })`.

- [ ] **Step 1: Tạo `src/components/ui/avatar-stack.tsx`** — render tối
      đa `max` `Avatar` xếp chồng (`-ml-2` cho avatar sau avatar đầu
      tiên), nếu `people.length > max` hiện thêm 1 "chip" tròn
      `+{people.length - max}`.

- [ ] **Step 2: Thêm `AssigneesPicker` vào `assignee-picker.tsx`** — tái
      dùng logic dropdown lọc theo `members` của `AssigneePicker`, nhưng
      `value: string[]`; render chip (avatar nhỏ + email/tên + nút xoá)
      cho mỗi email đã thêm, cộng 1 input để gõ/chọn thêm (Enter hoặc
      chọn từ dropdown để thêm vào mảng, không cho thêm trùng — so khớp
      không phân biệt hoa thường).

- [ ] **Step 3: Sửa `SerializedCard` trong `card-modal.tsx`** — đổi
      `assignee: string | null` thành `assignees: CardAssignee[]`; state
      `assignees: string[]` (mảng email) khởi tạo từ
      `card.assignees.map(a => a.email)`; `saveInfo()` gửi
      `assignees` thay `assignee` vào `updateWorkCard`. Đổi khối
      "Người phụ trách" dùng `<AssigneesPicker value={assignees}
      onChange={setAssignees} ... />` thay `<AssigneePicker>`.

- [ ] **Step 4: Sửa `new-task-button.tsx`** tương tự — state
      `assignees: string[]`, dùng `AssigneesPicker`, gửi lên
      `createWorkCard`.

- [ ] **Step 5: Sửa cột "Phụ trách" trong `work-list-view.tsx`** — thay
      `card.assignee ? <Avatar .../> : "—"` bằng
      `card.assignees.length ? <AvatarStack people={card.assignees.map(a
      => ({ name: a.name ?? a.email }))} /> : "—"`.

- [ ] **Step 6: Sửa `CardBody` trong `kanban-board.tsx`** — thay avatar
      đơn (nếu có) bằng `AvatarStack` tương tự.

- [ ] **Step 7: Sửa `page.tsx`'s card mapping** — map
      `assignees: card.assignees` (đã là `CardAssignee[]` từ Task 5's
      `getAccessibleBoards`) thay vì field `assignee` cũ.

- [ ] **Step 8: Thêm i18n keys** — `cardAssigneesPh` ("Thêm người phụ
      trách…" / "Add people…"), `cardAssigneesHint` (bản nhiều-người của
      `cardAssigneeHint` cũ), `removeAssigneeLabel` ("Bỏ khỏi thẻ" /
      "Remove from card"), `moreAssigneesLabel` dùng cho "+N" nếu cần
      `aria-label`.

- [ ] **Step 9: `npx tsc --noEmit`** — kỳ vọng sạch hoàn toàn trên toàn
      bộ dự án.

- [ ] **Step 10: Xác minh thủ công qua dev server + Playwright** — tạo 1
      thẻ với 3 người phụ trách (ít nhất 1 email chưa có tài khoản), xác
      nhận: avatar xếp chồng hiện đúng ở List + Kanban; mở lại card-modal
      xác nhận cả 3 còn nguyên, xoá bớt 1 người rồi lưu, tải lại xác nhận
      chỉ còn 2; thẻ có người-chưa-có-tài-khoản vẫn hiển thị bình thường
      (không lỗi).

- [ ] **Step 11: `npm test`** — suite hiện có + test mới ở Task 4 phải
      xanh toàn bộ.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(workspace): multi-assignee picker and avatar stack across card UI"
```
