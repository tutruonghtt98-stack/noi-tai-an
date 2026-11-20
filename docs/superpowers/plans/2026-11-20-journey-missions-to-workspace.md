# Bỏ Nhiệm vụ chính, dùng việc Workspace đến hạn thay thế — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin-authored "Nhiệm vụ chính" (Core Missions) with
due-today Workspace tasks, both in the daily task list UI and in the
day-completion / level-unlock gating logic, so users only manage work in
one place.

**Architecture:** `getJourneyDashboard` (journey-queries.ts) stops querying
`JourneyMission`/`JourneyMissionCompletion` and gains a day-completion-rate
gate computation plus a new "has activity today" signal (habits done today
OR a `WorkCardEvent` today moving a card to Review/Done). `completeJourneyDay`
and `setJourneyRestDay` (actions/journey.ts) swap their mission-count checks
for that signal. A new `completeJourneyWorkspaceCard` action delegates to the
existing `moveWorkCard` (actions/work.ts) so card permission/approval rules
stay centralized. The UI (`journey-controls.tsx`, `page.tsx`) swaps the
Core Missions list for a Workspace-task list with a quick-check checkbox,
drops the now-redundant "assigned today" sidebar and the "missing missions"
recovery section.

**Tech Stack:** Next.js App Router, Prisma/Postgres, Zod. `tsx --test` for
the one pure function this plan touches (`getJourneyLevelGate`); everything
else is DB-coupled server actions/queries and UI, verified via `tsc --noEmit`,
`npm test` (regression check), and the dev server + Playwright — matching
this repo's established testing boundary (confirmed across every prior
plan this session).

**Spec:** `docs/superpowers/specs/2026-11-20-journey-missions-to-workspace-design.md`

## Global Constraints

- Không có thay đổi schema Prisma — không cần `prisma db push` (spec
  Constraints).
- Giữ nguyên toàn bộ quy tắc phân quyền/duyệt thẻ hiện có của Workspace —
  `completeJourneyWorkspaceCard` không tự ghi DB, chỉ chọn đích rồi gọi
  `moveWorkCard` đã có (spec Approaches, Anti-goals).
- Phần **điểm ngày** (component "workspace" trong
  `calculateJourneyDailyScore`) giữ nguyên dùng `completedAt` — chỉ tín
  hiệu "được phép hoàn thành ngày"/"chặn ghi ngày nghỉ" đổi sang sự kiện
  `WorkCardEvent` hôm nay, không đổi cách tính điểm (spec, Quyết định sau
  builder check #2).
- Không đổi `JourneyPersonalMission` ("Nhiệm vụ cá nhân") hay Thử thách
  ngày/tuần/tháng/Tổng kết chặng nói chung — chỉ đổi đúng tiêu chí mission
  trong điều kiện mở khoá (spec Non-goals).
- Copy UI mới đi qua `src/lib/i18n/vi.ts`/`en.ts`, không hardcode chuỗi
  (quy ước đã thiết lập trong session này).

## Review Focus

- Người được giao thẻ nhưng không sở hữu bảng tích nhanh — thẻ chuyển
  sang "Xem lại" (không phải "Hoàn thành"), `completedAt` vẫn null, nhưng
  tín hiệu "có hoạt động hôm nay" (dùng cho cả Hoàn thành ngày và chặn
  ghi Ngày nghỉ) vẫn phải nhận ra đúng hoạt động này. → Task 2, 4.
- Điều kiện "có hoạt động hôm nay" là **OR** (thói quen HOẶC Workspace),
  không phải AND — chỉ cần 1 trong 2 là đủ. → Task 4.
- `REST_AFTER_PROGRESS` (chặn ghi Ngày nghỉ sau khi đã có hoạt động) phải
  dùng đúng tín hiệu MỚI, không còn đếm `JourneyMissionCompletion` (đã
  luôn-bằng-0, guard cũ coi như vô tác dụng). → Task 4.
- Danh sách việc Workspace rỗng (không có thẻ nào đến hạn hôm nay) phải
  hiện trạng thái rỗng hợp lý trong ô "Công việc cần làm", không phải
  danh sách trống trơn/gãy giao diện. → Task 6.
- `getJourneyLevelGate`'s tham số đổi tên phải được dùng **nhất quán ở cả
  2 nơi gọi** (`getJourneyDashboard`'s transition gate VÀ
  `submitJourneyLevelReview`) — lệch 1 trong 2 nơi sẽ âm thầm làm hỏng
  đúng 1 trong 2 cổng mở khoá. → Task 1, 2, 5.

---

## File Structure

- `src/lib/journey-calendar.ts` — modify: `getJourneyLevelGate` đổi tên
  tham số/field trả về.
- `src/lib/journey-calendar.test.ts` — modify: cập nhật 2 test theo tên
  mới.
- `src/lib/journey-queries.ts` — modify: `getJourneyDashboard` bỏ truy
  vấn Nhiệm vụ chính, đổi công thức mở khoá cấp độ sang đếm ngày hoàn
  thành, thêm field `workspaceTasks` trả về; thêm hàm mới
  `hasJourneyActivityToday`.
- `src/actions/journey.ts` — modify: `completeJourneyDay`,
  `setJourneyRestDay`, `submitJourneyLevelReview` đổi điều kiện; thêm
  `completeJourneyWorkspaceCard`; cuối cùng xoá `completeJourneyMission`
  (Task 7, sau khi xác nhận hết nơi gọi).
- `src/app/(app)/journey/journey-controls.tsx` — modify: đổi prop
  `missions`/`recoveryMissions` của `JourneyControls` thành
  `workspaceTasks`, render danh sách mới có dấu tích, bỏ khối "Nhiệm vụ
  còn thiếu trong chặng".
- `src/app/(app)/journey/page.tsx` — modify: dùng `journey.workspaceTasks`
  thay `missions`, bỏ khối "Việc được giao hôm nay", sửa 2 dòng chú thích
  còn nhắc "mission".
- `src/lib/i18n/vi.ts` / `en.ts` — modify: thêm key UI mới + lỗi
  `DAILY_ACTIVITY_REQUIRED`.
- `src/lib/use-action.ts` — modify: map lỗi `DAILY_ACTIVITY_REQUIRED`
  sang chuỗi thân thiện.

---

### Task 1: `getJourneyLevelGate` — đổi tên tham số sang khái niệm chung

**Files:**
- Modify: `src/lib/journey-calendar.ts`
- Modify: `src/lib/journey-calendar.test.ts`

**Interfaces:**
- Produces: `getJourneyLevelGate(input: { completedUnits: number;
  totalUnits: number; thresholdPercent: number; monthlyChallengeCompleted:
  boolean; reviewPassed: boolean }): { completionRate: number;
  activityPassed: boolean; monthlyChallengePassed: boolean; reviewPassed:
  boolean; canAdvance: boolean }` — Task 2 và Task 5 gọi đúng shape này ở
  2 nơi khác nhau.

- [ ] **Step 1: Sửa 2 test hiện có trong `journey-calendar.test.ts`** đổi
      field `completedMissions`/`totalMissions` thành
      `completedUnits`/`totalUnits`, và assertion `gate.missionsPassed`
      thành `gate.activityPassed` (giữ nguyên giá trị số liệu, chỉ đổi
      tên).

- [ ] **Step 2: Chạy `npx tsx --test src/lib/journey-calendar.test.ts`,
      xác nhận FAIL** (lỗi thiếu property / type mismatch vì hàm chưa đổi).

- [ ] **Step 3: Sửa `getJourneyLevelGate` trong `journey-calendar.ts`**
      — đổi tên 2 tham số input (`completedMissions`→`completedUnits`,
      `totalMissions`→`totalUnits`) và field trả về
      (`missionsPassed`→`activityPassed`), logic tính toán giữ nguyên
      100% (chỉ đổi tên, không đổi công thức).

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/journey-calendar.ts src/lib/journey-calendar.test.ts
git commit -m "refactor(journey): generalize getJourneyLevelGate's mission-specific param names"
```

---

### Task 2: `getJourneyDashboard` — bỏ Nhiệm vụ chính, đổi công thức mở khoá, thêm tín hiệu hoạt động

**Files:**
- Modify: `src/lib/journey-queries.ts`

**Interfaces:**
- Consumes: `getJourneyLevelGate` shape mới (Task 1).
- Produces: `getJourneyDashboard(user)`'s trả về thêm field
  `workspaceTasks: { id: string; title: string; dueDate: Date | null;
  completedAt: Date | null; listName: string; boardName: string }[]`
  (map từ `workspaceCards` đã có sẵn) — Task 6/7 dùng field này; **bỏ**
  hẳn 2 field `missions`/`recoveryMissions` khỏi kết quả trả về (Task 6/7
  không còn nhận 2 field này). Thêm hàm mới
  `hasJourneyActivityToday(user: CurrentUser, dashboard: Awaited<ReturnType<typeof getJourneyDashboard>>): Promise<boolean>`
  (export từ cùng file) — Task 4 dùng hàm này.

- [ ] **Step 1: Trong `getJourneyDashboard`, bỏ 2 truy vấn
      `db.journeyMission.findMany`** (mục `missions` và `recoveryMissions`)
      khỏi mảng `Promise.all` ở đầu hàm — xoá luôn 2 biến kết quả tương
      ứng và mọi chỗ dùng chúng (`missionCompletions`,
      `missions.length`) trong phần tính `dailyScore`.

- [ ] **Step 2: Sửa lời gọi `calculateJourneyDailyScore`** — bỏ hẳn 2
      field `missionsDone`/`missionsDue` khỏi object truyền vào (hàm đã
      có sẵn cơ chế bỏ qua thành phần không có dữ liệu, không cần đổi gì
      ở `journey-scoring.ts`).

- [ ] **Step 3: Sửa khối tính cổng mở khoá cấp độ** (đoạn gọi
      `getJourneyLevelGate` bên trong logic chuyển ngày, hiện đang đếm
      `journeyMissionCompletion`) — thay bằng: `totalUnits =
      currentLevel.endDay - currentLevel.startDay + 1`; `completedUnits =
      await tx.journeyDayRecord.count({ where: { journeyId: current.id,
      journeyDay: { gte: currentLevel.startDay, lte: currentLevel.endDay
      }, status: { in: ["COMPLETED", "REST"] } } })`; truyền
      `completedUnits`/`totalUnits` (không phải
      `completedMissions`/`totalMissions`) vào `getJourneyLevelGate`,
      đọc kết quả qua field mới `gate.activityPassed` (không phải
      `gate.missionsPassed`).

- [ ] **Step 4: Thêm field `workspaceTasks` vào object trả về cuối hàm**
      — map từ `workspaceCards` đã truy vấn sẵn:
      `workspaceCards.map(c => ({ id: c.id, title: c.title, dueDate:
      c.dueDate, completedAt: c.completedAt, listName: c.list.name,
      boardName: c.list.board.name }))`. Bỏ `missions`/`recoveryMissions`
      khỏi object trả về.

- [ ] **Step 5: Thêm hàm mới `hasJourneyActivityToday`** ở cuối file,
      export, nhận `(user: CurrentUser, dashboard)`:
      - Đếm thói quen hôm nay đã làm:
        `dashboard.habits.filter(h => h.stats.scheduledToday &&
        h.stats.doneToday).length > 0`.
      - Nếu chưa có thói quen nào xong, truy vấn tiếp 1 lần:
        `db.workCardEvent.findFirst({ where: { actorUserId: user.id,
        occurredAt: { gte: todayDate, lt: tomorrowDate }, toStatus: {
        in: ["listReview", "listDone"] } } })` (dùng lại đúng cặp
        `todayDate`/`tomorrowDate` — kiểu `toDbDate(todayISO(...))` —
        đã tính sẵn trong `getJourneyDashboard`, tính lại y hệt ở đây
        bằng `toDbDate`/`todayISO`/`addDays` với `dashboard.journey.timezone`).
      - Trả `true` nếu 1 trong 2 đúng.

- [ ] **Step 6: `npx tsc --noEmit`** — kỳ vọng lỗi xuất hiện ở
      `page.tsx`/`journey-controls.tsx` (đọc `journey.missions`/
      `journey.recoveryMissions` đã bị xoá) và ở `actions/journey.ts`
      (gọi `getJourneyLevelGate` với tên field cũ ở
      `submitJourneyLevelReview`) — đúng như dự kiến, Task 3-7 xử lý
      tiếp, không phải lỗi của task này.

- [ ] **Step 7: `npm test`** — suite hiện có (không đụng tới
      `journey-queries.ts`, DB-coupled, không có unit test riêng theo
      quy ước repo) phải vẫn xanh.

- [ ] **Step 8: Commit**

```bash
git add src/lib/journey-queries.ts
git commit -m "feat(journey): replace mission-based dashboard data with Workspace tasks and a day-completion gate"
```

---

### Task 3: `completeJourneyWorkspaceCard` — tích nhanh 1 thẻ Workspace từ Hành trình

**Files:**
- Modify: `src/actions/journey.ts`

**Interfaces:**
- Consumes: `moveWorkCard(id: string, toListId: string)` (đã có, từ
  `src/actions/work.ts`).
- Produces: `completeJourneyWorkspaceCard(cardId: string)` — Task 6's UI
  gọi đúng action này.

- [ ] **Step 1: Thêm `completeJourneyWorkspaceCard(cardId: string)` vào
      `src/actions/journey.ts`**, import `moveWorkCard` từ
      `@/actions/work`:
      - `requireUser()`.
      - Tra `db.workCard.findUnique({ where: { id: cardId }, select: {
        listId: true, list: { select: { boardId: true, board: { select:
        { userId: true } } } } } })` — nếu không có, throw
        `UserError("VALIDATION")`.
      - `isOwner = card.list.board.userId === user.id`.
      - `targetList = await db.workList.findFirst({ where: { boardId:
        card.list.boardId, name: isOwner ? "listDone" : "listReview" },
        select: { id: true } })` — nếu không tìm thấy, throw
        `UserError("VALIDATION")`.
      - `return moveWorkCard(cardId, targetList.id);` — để `moveWorkCard`
        tự lo phần kiểm tra quyền/tính điểm/snapshot (action này không
        tự ghi DB).

- [ ] **Step 2: `npx tsc --noEmit`** — không có lỗi mới liên quan đến
      action vừa thêm (lỗi còn lại từ Task 2 vẫn còn, chưa phải việc của
      task này).

- [ ] **Step 3: Commit**

```bash
git add src/actions/journey.ts
git commit -m "feat(journey): add completeJourneyWorkspaceCard, delegating to the existing moveWorkCard"
```

---

### Task 4: Đổi điều kiện "Hoàn thành ngày" / chặn "Ngày nghỉ" sang tín hiệu hoạt động mới

**Files:**
- Modify: `src/actions/journey.ts`
- Modify: `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts`
- Modify: `src/lib/use-action.ts`

**Interfaces:**
- Consumes: `hasJourneyActivityToday(user, dashboard)` (Task 2).

- [ ] **Step 1: Trong `completeJourneyDay`, thay khối tính
      `completedMissions`/`if (completedMissions === 0) throw
      UserError("MISSION_REQUIRED")`** bằng:
      `if (!(await hasJourneyActivityToday(user, dashboard))) throw new
      UserError("DAILY_ACTIVITY_REQUIRED");` (xoá hẳn mã lỗi
      `MISSION_REQUIRED`, không giữ lại).

- [ ] **Step 2: Trong `setJourneyRestDay`, thay khối tính
      `completedMissions`/`if (completedMissions) throw
      UserError("REST_AFTER_PROGRESS")`** bằng:
      `if (await hasJourneyActivityToday(user, dashboard)) throw new
      UserError("REST_AFTER_PROGRESS");` (giữ nguyên mã lỗi
      `REST_AFTER_PROGRESS`, chỉ đổi nguồn tín hiệu).

- [ ] **Step 3: Đổi i18n key cho lỗi mới** — trong `vi.ts`/`en.ts`, đổi
      key `journey.missionRequired` (đã thêm ở lần sửa trước, hiện đang
      nói "Nhiệm vụ chính") thành nội dung mới phù hợp: vi:
      `"Cần hoàn thành ít nhất 1 thói quen hoặc 1 việc Workspace đến hạn
      hôm nay trước khi hoàn thành ngày."`, en tương ứng. Đổi tên key
      thành `dailyActivityRequired` nếu muốn, hoặc giữ tên cũ nhưng đổi
      nội dung — **giữ nguyên tên key cũ `missionRequired` được, chỉ cần
      đổi nội dung chuỗi**, để tránh phải sửa thêm 1 chỗ không cần thiết.

- [ ] **Step 4: Trong `use-action.ts`, đổi mapping**
      `if (code === "MISSION_REQUIRED") return t.journey.missionRequired;`
      thành `if (code === "DAILY_ACTIVITY_REQUIRED") return
      t.journey.missionRequired;` (field i18n key không đổi tên, chỉ nội
      dung chuỗi đã đổi ở Step 3; mã lỗi khớp với Step 1).

- [ ] **Step 5: `npx tsc --noEmit`**

- [ ] **Step 6: `npm test`** — vẫn xanh.

- [ ] **Step 7: Commit**

```bash
git add src/actions/journey.ts src/lib/i18n/vi.ts src/lib/i18n/en.ts src/lib/use-action.ts
git commit -m "feat(journey): gate day-completion and rest-day on habit/Workspace activity instead of missions"
```

---

### Task 5: `submitJourneyLevelReview` — đổi công thức cổng mở khoá giống Task 2

**Files:**
- Modify: `src/actions/journey.ts`

**Interfaces:**
- Consumes: `getJourneyLevelGate` shape mới (Task 1).

- [ ] **Step 1: Trong `submitJourneyLevelReview`, thay khối
      `Promise.all([db.journeyMission.count(...), db.journeyMissionCompletion.count(...), ...])`**
      — bỏ 2 truy vấn mission, thay bằng tính `totalUnits`/`completedUnits`
      y hệt công thức ở Task 2 Step 3 (`level.endDay - level.startDay +
      1`, và đếm `journeyDayRecord` status COMPLETED/REST trong khoảng
      ngày đó).

- [ ] **Step 2: Sửa lời gọi `getJourneyLevelGate`** — truyền
      `completedUnits`/`totalUnits` (không phải
      `completedMissions`/`totalMissions`); đọc `gate.activityPassed`
      (không phải `gate.missionsPassed`) trong điều kiện
      `if (!gate.missionsPassed || !gate.monthlyChallengePassed) throw ...`.

- [ ] **Step 3: Sửa `reportSnapshot`** — đổi field `completedMissions`/
      `totalMissions` đang lưu vào JSON thành `completedUnits`/
      `totalUnits` (chỉ đổi tên field lưu trữ, giữ nguyên giá trị/ý
      nghĩa "tỉ lệ đạt ngưỡng của chặng này").

- [ ] **Step 4: `npx tsc --noEmit`** — kỳ vọng không còn lỗi nào liên
      quan tới `getJourneyLevelGate`/`actions/journey.ts` nữa.

- [ ] **Step 5: `npm test`**

- [ ] **Step 6: Commit**

```bash
git add src/actions/journey.ts
git commit -m "feat(journey): use the day-completion-rate gate for level review submission"
```

---

### Task 6: UI `journey-controls.tsx` — danh sách việc Workspace thay Nhiệm vụ chính

**Files:**
- Modify: `src/app/(app)/journey/journey-controls.tsx`
- Modify: `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `workspaceTasks` shape từ Task 2 (`{ id, title, dueDate,
  completedAt, listName, boardName }[]`), `completeJourneyWorkspaceCard`
  (Task 3).
- Produces: `JourneyControls`'s props không còn `missions`/
  `recoveryMissions`, thay bằng `workspaceTasks: { id: string; title:
  string; dueDate: Date | null; completedAt: Date | null; listName:
  string; boardName: string }[]` — Task 7's `page.tsx` truyền đúng prop
  này.

- [ ] **Step 1: Đổi type `Mission`/prop `missions` của `JourneyControls`**
      thành prop mới `workspaceTasks` với type nêu trên; xoá hẳn prop
      `recoveryMissions` khỏi signature.

- [ ] **Step 2: Trong phần render tab "Ngày" của "Công việc cần làm"**,
      thay khối `missions.map(...)` (checkbox gọi
      `completeJourneyMission`) bằng `workspaceTasks.map(...)`:
      - Mỗi item: checkbox gọi
        `exec(() => completeJourneyWorkspaceCard(task.id), { success:
        w.workspaceTaskCompleted ?? "Đã ghi nhận.", onSuccess: refresh
        })`.
      - Nếu `task.listName === "listReview"` (đã tích, đang chờ chủ
        bảng duyệt): hiện badge "Đang chờ duyệt" cạnh tiêu đề, **không**
        gạch ngang, checkbox ở trạng thái đã tích nhưng vô hiệu hoá
        (không bấm lại được).
      - Nếu `workspaceTasks.length === 0`: hiện `<Empty icon={ListChecks}
        text="Chưa có việc Workspace nào đến hạn hôm nay." />` (tái dùng
        component `Empty` đã import sẵn trong file, cùng cách
        `missions.length === 0` cũ đang làm).
      - Badge đếm ở đầu card (hiện `{missions.filter(completed).length}/
        {missions.length}`) đổi theo `workspaceTasks` (đếm
        `listName !== "listToDo" && listName !== "listInProgress"` làm
        "đã xong", hoặc đơn giản đếm `completedAt != null` — builder tự
        chọn tiêu chí nào khớp rõ nhất với cách hiển thị ở Step trên,
        miễn nhất quán).

- [ ] **Step 3: Xoá hẳn `<section>` "Nhiệm vụ còn thiếu trong chặng"**
      (khối `{recoveryMissions.length > 0 && (...)}`) khỏi
      `JourneyControls`.

- [ ] **Step 4: Xoá import `completeJourneyMission` khỏi file** (không
      còn nơi gọi trong file này sau Step 2).

- [ ] **Step 5: Thêm i18n key mới nếu cần** (vd.
      `workspaceTaskCompleted`, `workspaceTaskPendingReview`,
      `emptyWorkspaceToday`) vào `vi.ts`/`en.ts`.

- [ ] **Step 6: `npx tsc --noEmit`**

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/journey/journey-controls.tsx src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "feat(journey): show due-today Workspace tasks with a quick-check instead of Core Missions"
```

---

### Task 7: UI `page.tsx` — gắn dữ liệu mới, bỏ khối trùng lặp, dọn `completeJourneyMission`

**Files:**
- Modify: `src/app/(app)/journey/page.tsx`
- Modify: `src/actions/journey.ts`

**Interfaces:**
- Consumes: `journey.workspaceTasks` (Task 2), `JourneyControls`'s prop
  mới (Task 6).

- [ ] **Step 1: Bỏ biến cục bộ `missions`/`missionsDone`** (đang map từ
      `journey.missions`) — không còn cần, `journey.workspaceTasks` dùng
      thẳng.

- [ ] **Step 2: Đổi prop truyền vào `<JourneyControls>`** — bỏ
      `missions={missions}` và `recoveryMissions={...}`, thay bằng
      `workspaceTasks={journey.workspaceTasks}`.

- [ ] **Step 3: Xoá hẳn khối "Việc được giao hôm nay"** (section hiện
      `journey.workspaceCards`/tương đương ở cột bên, không có dấu
      tích, link sang Workspace) — đã trùng với ô "Công việc cần làm"
      mới ở Task 6.

- [ ] **Step 4: Sửa 2 dòng chú thích còn nhắc "mission"** — ô Điểm kinh
      nghiệm: đổi "từ mission & thử thách" thành "từ thử thách & hoạt
      động"; ô Điểm ngày: đổi "mission, thói quen, Workspace" thành
      "thói quen, Workspace".

- [ ] **Step 5: Grep xác nhận không còn tham chiếu nào tới
      `completeJourneyMission`/`journey.missions`/`journey.recoveryMissions`
      trong `src/`** — nếu còn, dừng lại, quay lại Task 6 xử lý nốt
      trước khi tiếp tục.

- [ ] **Step 6: Xoá hẳn action `completeJourneyMission` khỏi
      `src/actions/journey.ts`** (đã xác nhận hết nơi gọi ở Step 5).

- [ ] **Step 7: `npx tsc --noEmit`** — kỳ vọng sạch hoàn toàn trên toàn
      bộ dự án (đây là task cuối).

- [ ] **Step 8: `npm test`**

- [ ] **Step 9: Xác minh thủ công qua dev server + Playwright** — mở
      trang Hành trình, xác nhận: ô "Công việc cần làm" (tab Ngày) hiện
      đúng việc Workspace đến hạn hôm nay (hoặc trạng thái rỗng nếu
      không có); không còn khối "Việc được giao hôm nay" trùng lặp;
      không còn khối "Nhiệm vụ còn thiếu trong chặng"; tích 1 việc
      Workspace do chính mình sở hữu bảng → biến mất khỏi danh sách
      (đã vào Hoàn thành); nếu có thẻ của bảng người khác giao cho tài
      khoản này, tích vào → hiện badge "Đang chờ duyệt", không biến
      mất; bấm "Hoàn thành ngày" khi đã có ít nhất 1 hoạt động (thói
      quen hoặc việc Workspace) → thành công, không còn đòi "Nhiệm vụ
      chính"; thử ghi "Ngày nghỉ" sau khi đã có hoạt động hôm nay → bị
      chặn với thông báo rõ ràng (không phải lỗi chung chung).

- [ ] **Step 10: Commit**

```bash
git add src/app/\(app\)/journey/page.tsx src/actions/journey.ts
git commit -m "feat(journey): wire the new workspace-task dashboard into the journey page, retire completeJourneyMission"
```
