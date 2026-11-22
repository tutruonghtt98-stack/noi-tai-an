# Tách "Xác nhận thức dậy" thành tính năng riêng theo ngày — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wake-time deadline gate wrongly baked into the weekly
challenge's self-confirm button with a real, independent, once-per-day
wake-up confirmation that also counts toward the existing "has activity
today" signal.

**Architecture:** One new `JourneyDayRecord` column (`wakeConfirmedAt`)
tracks the per-day confirmation. A new server action validates the
deadline server-side (the old check was client-only) and sets it.
`hasJourneyActivityToday` gains a third OR branch. The weekly challenge
component loses its entire wake-time block, reverting to a plain,
ungated self-confirm. A new UI block in `JourneyControls` (replacing the
existing unconditional "Giờ thức dậy cố định" summary line) owns both
editing the committed wake time and the new daily confirm button.

**Tech Stack:** Next.js App Router, Prisma/Postgres, Zod. DB-coupled
server actions/queries and UI are verified via `tsc --noEmit`, `npm test`
(regression check on the pure-function suite), and the dev server +
Playwright — this repo's established testing boundary (no unit test
exists or is expected for DB-coupled code in this plan).

**Spec:** `docs/superpowers/specs/2026-11-22-journey-daily-wakeup-confirm-design.md`

## Global Constraints

- Không có đổi gì ở nội dung/cách admin soạn Thử thách tuần, Thử thách
  ngày/tháng, hay Tổng kết chặng (spec Non-goals).
- `hasJourneyActivityToday`'s chữ ký `(user, dashboard)` giữ nguyên — chỉ
  thêm 1 nhánh OR, không đổi tham số (spec Constraints).
- Mọi `prisma db push` cần xin xác nhận lại ngay trước khi chạy (quy ước
  đã thiết lập trong session này).
- Copy UI mới đi qua `src/lib/i18n/vi.ts`/`en.ts`, không hardcode chuỗi.

## Review Focus

- Chưa từng đặt giờ thức dậy cam kết (`wakeTime` là `undefined`) — nút
  xác nhận thức dậy không được chặn theo giờ (giữ đúng quy ước hiện có:
  "chưa đặt giờ thì không chặn theo giờ"), chỉ hiện nút "Đặt giờ thức dậy
  cam kết" như trước. → Task 3, 5.
- Bấm xác nhận thức dậy sau khi đã quá giờ cam kết — server phải tự chặn
  (`WAKE_UP_TOO_LATE`), không chỉ dựa vào việc client disable nút (client
  có thể bị bypass/đồng hồ máy lệch). → Task 3.
- Bấm xác nhận thức dậy 2 lần trong cùng 1 ngày — lần thứ 2 phải là
  no-op an toàn (trả `false`), không ghi đè `wakeConfirmedAt` hay lỗi. →
  Task 3.
- Xác nhận thức dậy đúng giờ hôm nay phải thực sự mở khoá được "Hoàn
  thành ngày" ngay cả khi không có thói quen/việc Workspace nào hôm đó —
  đúng tinh thần OR ba nhánh, không phải thêm 1 điều kiện AND. → Task 2.
- Thử thách tuần đã từng bị khoá do giờ giấc cũ (dữ liệu test còn sót)
  vẫn phải hiển thị đúng ("Đã hoàn thành", không còn dòng cảnh báo giờ
  nào) sau khi gỡ bỏ phần giờ khỏi component đó. → Task 4.

---

## File Structure

- `prisma/schema.prisma` — modify: thêm `JourneyDayRecord.wakeConfirmedAt
  DateTime?`.
- `src/lib/journey-queries.ts` — modify: `hasJourneyActivityToday` thêm
  nhánh OR thứ 3.
- `src/actions/journey.ts` — modify: thêm `confirmWakeUpToday()`.
- `src/lib/use-action.ts` — modify: map lỗi `WAKE_UP_TOO_LATE` sang chuỗi
  thân thiện.
- `src/app/(app)/journey/journey-controls.tsx` — modify:
  `JourneyWeeklyChallengeActions` bỏ hẳn phần giờ giấc; `JourneyControls`
  (khối "Giờ thức dậy cố định" ở đầu) thay bằng khối mới có sửa giờ + nút
  xác nhận thức dậy hôm nay.
- `src/app/(app)/journey/page.tsx` — modify: truyền thêm
  `wakeConfirmedAt` vào `JourneyControls`.
- `src/lib/i18n/vi.ts` / `en.ts` — modify: thêm key UI mới + lỗi
  `WAKE_UP_TOO_LATE`.

---

### Task 1: Schema — thêm cột `wakeConfirmedAt`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `JourneyDayRecord.wakeConfirmedAt: Date | null` — Task 2, 3,
  5 đọc/ghi field này.

- [ ] **Step 1: Thêm `wakeConfirmedAt DateTime?` vào `model
      JourneyDayRecord`** trong `prisma/schema.prisma` (cạnh các field
      thời gian khác của model này, vd. `completedAt`).

- [ ] **Step 2: Xin xác nhận người dùng rồi chạy `npx prisma db push`,
      sau đó `npx prisma generate`**

- [ ] **Step 3: `npx tsc --noEmit`** — kỳ vọng sạch (chỉ thêm field mới,
      không đổi gì đang dùng).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(journey): add JourneyDayRecord.wakeConfirmedAt"
```

---

### Task 2: `hasJourneyActivityToday` — thêm tín hiệu xác nhận thức dậy

**Files:**
- Modify: `src/lib/journey-queries.ts`

**Interfaces:**
- Consumes: `JourneyDayRecord.wakeConfirmedAt` (Task 1).

- [ ] **Step 1: Trong `hasJourneyActivityToday(user, dashboard)`, thêm
      nhánh OR thứ 3** — hàm hiện trả `true` nếu (a) có thói quen hôm nay
      đã làm, HOẶC (b) có `WorkCardEvent` hôm nay chuyển thật vào Xem
      lại/Hoàn thành; thêm: HOẶC (c) `dashboard.dayRecord?.wakeConfirmedAt
      != null`. Đặt điều kiện (c) là **nhánh kiểm tra đầu tiên** (rẻ nhất,
      không cần query DB) trước khi tới nhánh (b) (cần query
      `WorkCardEvent`) — chỉ query khi nhánh rẻ hơn đều `false`.

- [ ] **Step 2: `npx tsc --noEmit`**

- [ ] **Step 3: `npm test`** — vẫn xanh (hàm này không có unit test theo
      quy ước repo, DB-coupled).

- [ ] **Step 4: Commit**

```bash
git add src/lib/journey-queries.ts
git commit -m "feat(journey): count a confirmed wake-up as activity today"
```

---

### Task 3: `confirmWakeUpToday` — action mới, kiểm tra giờ thật ở server

**Files:**
- Modify: `src/actions/journey.ts`
- Modify: `src/lib/use-action.ts`
- Modify: `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `getCommittedWakeTime` (đã có, từ
  `@/lib/journey-goal-domains`), `timeInZone` (đã có, từ `@/lib/dates`).
- Produces: `confirmWakeUpToday(): Promise<Result<boolean>>` — Task 5's
  UI gọi đúng action này; trả `false` nếu đã xác nhận rồi hôm nay (no-op),
  `true` nếu vừa xác nhận thành công.

- [ ] **Step 1: Thêm `confirmWakeUpToday()` vào `src/actions/journey.ts`**:
      - `requireUser()`, `getJourneyDashboard(user)`.
      - Nếu không có `dashboard?.dayRecord` hoặc
        `dayRecord.status !== "IN_PROGRESS"` → throw
        `UserError("JOURNEY_NOT_ACTIVE")`.
      - Nếu `dashboard.dayRecord.wakeConfirmedAt` đã có giá trị → return
        `false` (không ghi đè, không lỗi).
      - `const wakeTime = getCommittedWakeTime(dashboard.journey.commitments);`
        — nếu có giá trị, so `timeInZone(new Date(),
        dashboard.journey.timezone) > wakeTime` → throw
        `UserError("WAKE_UP_TOO_LATE")` (chưa đặt giờ thì không chặn,
        giữ đúng quy ước hiện có).
      - `await db.journeyDayRecord.update({ where: { id:
        dashboard.dayRecord.id }, data: { wakeConfirmedAt: new Date() }
        });`, `revalidatePath("/journey")`, return `true`.

- [ ] **Step 2: Thêm i18n key lỗi mới** — `vi.ts`/`en.ts`:
      `journey.wakeUpTooLate`: vi "Đã quá giờ cam kết, không thể xác
      nhận thức dậy cho hôm nay nữa." / en "You're past your committed
      time — can't confirm wake-up for today anymore."

- [ ] **Step 3: Trong `use-action.ts`, thêm mapping**
      `if (code === "WAKE_UP_TOO_LATE") return t.journey.wakeUpTooLate;`

- [ ] **Step 4: `npx tsc --noEmit`**

- [ ] **Step 5: `npm test`**

- [ ] **Step 6: Commit**

```bash
git add src/actions/journey.ts src/lib/use-action.ts src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "feat(journey): add confirmWakeUpToday with a server-side deadline check"
```

---

### Task 4: Gỡ phần giờ giấc khỏi `JourneyWeeklyChallengeActions`

**Files:**
- Modify: `src/app/(app)/journey/journey-controls.tsx`

**Interfaces:**
- Produces: `JourneyWeeklyChallengeActions`'s `weekly` prop shrinks to
  `{ title: string; completed: boolean } | null` (bỏ `wakeTime`) — Task 5
  cập nhật đúng `page.tsx`'s lời gọi component này cho khớp.

- [ ] **Step 1: Trong `JourneyWeeklyChallengeActions`, xoá hoàn toàn**:
      state `editingWakeTime`/`wakeTimeInput`, `useEffect` tính `now`,
      biến `nowHHMM`/`deadline`/`withinDeadline`, hàm `saveWakeTime`,
      toàn bộ khối JSX hiển thị/sửa giờ (`editingWakeTime ? (...) :
      deadline ? (...) : (...)`), và 2 dòng cảnh báo giờ
      (`!withinDeadline`/`withinDeadline` paragraphs). Import
      `updateJourneyWakeTime`/`Pencil`/`AlarmClock` có thể cần bỏ khỏi
      file nếu không còn dùng ở đâu khác trong file (kiểm tra bằng grep
      trước khi xoá import).

- [ ] **Step 2: Nút tự xác nhận hoàn thành tuần chỉ còn**
      `disabled={weekly.completed || pending}` (bỏ `|| !withinDeadline`).

- [ ] **Step 3: Đổi type `weekly` prop** thành `{ title: string;
      completed: boolean } | null` (bỏ `wakeTime: string | undefined`).

- [ ] **Step 4: `npx tsc --noEmit`** — kỳ vọng lỗi xuất hiện ở
      `page.tsx` (vẫn truyền `wakeTime` vào prop đã bỏ) — Task 5 xử lý
      tiếp, không phải lỗi của task này.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/journey/journey-controls.tsx
git commit -m "fix(journey): drop the wake-time deadline from the weekly challenge button"
```

---

### Task 5: UI mới — xác nhận thức dậy hôm nay, gắn vào page.tsx

**Files:**
- Modify: `src/app/(app)/journey/journey-controls.tsx`
- Modify: `src/app/(app)/journey/page.tsx`
- Modify: `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `confirmWakeUpToday` (Task 3).
- Produces: `JourneyControls`'s prop list gains `wakeConfirmedAt: Date |
  null` (cạnh `wakeTime` đã có) — dùng để biết hôm nay đã xác nhận chưa.

- [ ] **Step 1: Trong `JourneyControls`, thêm prop
      `wakeConfirmedAt: Date | null`** vào signature.

- [ ] **Step 2: Thay khối hiện tại**
      `{wakeTime && (<div>...Giờ thức dậy cố định: {wakeTime}</div>)}`
      (ở đầu tab "Ngày") bằng 1 khối mới, luôn hiện (không còn điều kiện
      `wakeTime &&`):
      - Nếu chưa có `wakeTime` → hiện nút "Đặt giờ thức dậy cam kết" mở
        ô sửa giờ (tái dùng đúng state/UI chỉnh giờ vừa gỡ ra khỏi
        `JourneyWeeklyChallengeActions` ở Task 4 — chuyển state
        `editingWakeTime`/`wakeTimeInput` và khối JSX sửa giờ + hàm
        `saveWakeTime` (gọi `updateJourneyWakeTime`) sang đây).
      - Nếu có `wakeTime` và CHƯA sửa giờ và `wakeConfirmedAt` đã có giá
        trị hôm nay → hiện "Giờ thức dậy cố định: {wakeTime}" + badge
        "Đã xác nhận hôm nay" (disabled, không bấm lại được).
      - Nếu có `wakeTime` và chưa xác nhận hôm nay → hiện "Giờ thức dậy
        cố định: {wakeTime}" + nút sửa giờ (icon bút, như cũ) + nút
        "Xác nhận đã thức dậy hôm nay" gọi
        `exec(() => confirmWakeUpToday(), { success: ..., onSuccess:
        refresh })`.

- [ ] **Step 3: Trong `page.tsx`, bỏ prop `wakeTime` khỏi lời gọi
      `<JourneyWeeklyChallengeActions weekly={{...}} />`** (Task 4 đã bỏ
      field này khỏi type); thêm
      `wakeConfirmedAt={journey.dayRecord.wakeConfirmedAt}` vào lời gọi
      `<JourneyControls .../>` (giữ nguyên `wakeTime={getCommittedWakeTime(...)}`
      đã có sẵn ở đó).

- [ ] **Step 4: Thêm i18n key mới** (vd. `wakeUpConfirmed`: "Đã xác nhận
      hôm nay" / "Confirmed for today"; `confirmWakeUp`: "Xác nhận đã
      thức dậy hôm nay" / "Confirm you woke up today") vào `vi.ts`/`en.ts`.

- [ ] **Step 5: `npx tsc --noEmit`** — kỳ vọng sạch hoàn toàn trên toàn
      bộ dự án (task cuối).

- [ ] **Step 6: `npm test`**

- [ ] **Step 7: Xác minh thủ công qua dev server + Playwright**:
      - Tài khoản chưa có giờ cam kết → hiện nút "Đặt giờ thức dậy cam
        kết"; đặt giờ xong → hiện "Xác nhận đã thức dậy hôm nay".
      - Bấm xác nhận (trước giờ cam kết) → thành công, đổi thành "Đã xác
        nhận hôm nay", disabled.
      - Thử bấm "Hoàn thành ngày" ngay sau khi xác nhận thức dậy (chưa
        tick thói quen/việc Workspace nào khác) → phải thành công (không
        còn đòi hoạt động khác).
      - Card "Thử thách tuần" không còn hiện bất kỳ chữ nào về giờ giấc —
        chỉ còn tiêu đề/mô tả tuần + nút tự xác nhận hoàn thành tuần.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/journey/journey-controls.tsx src/app/\(app\)/journey/page.tsx src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "feat(journey): add the daily wake-up confirmation UI, wired into the journey page"
```
