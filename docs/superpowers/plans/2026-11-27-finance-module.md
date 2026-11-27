# Module quản lý tài chính cá nhân — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `/finance` module — ad-hoc and recurring
income, ad-hoc and recurring expense with per-category monthly budget
warnings — as designed in the finance-flows artifact, and back the
existing "chi tiêu hôm nay" card in the 180-day Journey with the same
transaction data (it represents today's non-fixed spending, i.e. the
ad-hoc expense flow).

**Architecture:** Three new Prisma models (`FinanceTransaction`,
`FinanceRecurringRule`, `FinanceBudget`) hang off `User`. A pure lib
(`src/lib/finance.ts`) computes budget-warning levels and the next run
date for a recurring rule; a DB-coupled lib (`src/lib/finance-queries.ts`)
reads the dashboard and lazily catches up any due recurring rules — the
same pattern `syncOverdueDiscipline` already uses for "background" work,
since this project has no real cron infra. Server actions
(`src/actions/finance.ts`) wrap `run()`/`UserError` like every other
action file. One new route (`src/app/(app)/finance/page.tsx` +
`finance-controls.tsx`) renders summary cards, budgets, quick-add forms,
recurring-rule management, and a recent-transactions list, wired into the
sidebar nav. The Journey module's quick expense card switches from its
own `JourneyExpenseEntry` upsert to reading/writing
`FinanceTransaction` directly (the old table and its data are left in
place, just no longer written to).

**Tech Stack:** Next.js App Router, Prisma/Postgres, Zod, the existing
`run()`/`requireUser()`/`UserError` server-action convention, `t`/`getI18n`
i18n. No e2e suite in this repo — pure-logic modules get `node:test`
(`src/lib/*.test.ts`), DB-coupled/UI code is verified via `tsc --noEmit`,
`npm test` (regression), and the dev server + Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-finance-module-design.md`

## Global Constraints

- Không xoá bảng/dữ liệu `JourneyExpenseEntry` cũ — chỉ ngừng ghi mới vào
  đó (Task 9), giữ nguyên trong schema làm dữ liệu lịch sử (spec "Nối với
  Hành trình 180 ngày").
- Không có model `Account` riêng — `accountName` là 1 field text tự do
  dùng chung thu/chi (spec).
- Không thêm giới hạn gói (`src/lib/plan.ts`) cho giao dịch/ngân sách/rule
  (spec Non-goals).
- Mọi `prisma db push` cần xin xác nhận người dùng ngay trước khi chạy
  (quy ước đã thiết lập trong session này).
- Copy UI mới đi qua `src/lib/i18n/vi.ts`/`en.ts`, không hardcode chuỗi.
- `amountVnd` validate `z.coerce.number().int().min(1).max(1_000_000_000)`
  (cùng biên với `expenseSchema` hiện có trong `src/actions/journey.ts`).

## Review Focus

- Chưa có `FinanceBudget` cho 1 category — chi tiêu vào category đó
  không được báo lỗi hay crash, chỉ đơn giản không có cảnh báo
  (`budgetWarningLevel` trả `"NONE"` khi `limitVnd <= 0`). → Task 2, 5.
- `runDueRecurringRules` chạy khi tài khoản đã bỏ lỡ NHIỀU kỳ liên tiếp
  (vd. không mở app 3 tháng với rule `MONTHLY`) — phải tự sinh đủ từng kỳ
  bị bỏ lỡ (vòng lặp tới khi `nextRunDate > today`), không chỉ sinh 1 lần
  rồi nhảy thẳng `nextRunDate` tới tương lai. → Task 4.
- Gọi `runDueRecurringRules` 2 lần liên tiếp trong cùng 1 ngày (vd. do
  tải lại trang) không được sinh trùng giao dịch — sau lần đầu,
  `nextRunDate` đã `> today` nên lần sau no-op. → Task 4.
- Tạo chi tiêu khiến tổng chi category đó **vừa vượt ngưỡng 100%** (không
  phải chỉ test ở ngưỡng 80%) — `budgetWarningLevel` phải phân biệt đúng
  cả 3 mức, không chỉ đúng `OVER_100` khi vượt rất xa. → Task 2.
- Xoá 1 `FinanceRecurringRule` đã từng sinh giao dịch — các
  `FinanceTransaction.recurringRuleId` trỏ tới rule đó không được chặn
  xoá hay để lại ràng buộc treo (`onDelete: SetNull` trên
  `recurringRuleId`, giữ nguyên lịch sử giao dịch). → Task 1, 5.
- Sau khi nối Journey (Task 9), người dùng đã có `JourneyExpenseEntry` cũ
  từ trước (ghi qua `saveJourneyExpense` đã xoá) — thẻ "chi tiêu hôm nay"
  không được cố đọc bảng cũ đó nữa hay lỗi vì thiếu dữ liệu; nó chỉ đọc
  `FinanceTransaction` mới, bắt đầu từ rỗng (`{ totalVnd: 0, entries: []
  }`) cho ngày hiện tại, không cần migrate dữ liệu cũ. → Task 9.

---

## File Structure

- `prisma/schema.prisma` — modify: 2 enum + 3 model mới, 3 relation mới
  trên `User`.
- `src/lib/dates.ts` — modify: thêm `addMonths`.
- `src/lib/dates.test.ts` — create: test `addMonths`.
- `src/lib/finance.ts` — create: `budgetWarningLevel`, `nextRunDateFor`
  (pure).
- `src/lib/finance.test.ts` — create: test 2 hàm trên.
- `src/lib/finance-queries.ts` — create: `getFinanceDashboard`,
  `runDueRecurringRules`, `getTodayVariableExpenses` (DB-coupled).
- `src/actions/finance.ts` — create: 6 server action.
- `src/lib/i18n/vi.ts` / `en.ts` — modify: thêm `nav.finance` + dict
  `finance`.
- `src/lib/use-action.ts` — modify: map lỗi `CATEGORY_REQUIRED`.
- `src/app/(app)/finance/page.tsx` — create.
- `src/app/(app)/finance/finance-controls.tsx` — create ("use client").
- `src/components/nav.tsx` — modify: thêm mục `finance` vào `NAV`.
- `src/actions/journey.ts` — modify: xoá `saveJourneyExpense`.
- `src/lib/journey-queries.ts` — modify: bỏ `include: { expense: true }`.
- `src/app/(app)/journey/page.tsx` — modify: gọi
  `getTodayVariableExpenses`, đổi prop truyền cho `JourneyControls`.
- `src/app/(app)/journey/journey-controls.tsx` — modify: khối "chi tiêu
  hôm nay" đổi sang đọc/ghi `FinanceTransaction`.

---

### Task 1: Schema — `FinanceTransaction`/`FinanceRecurringRule`/`FinanceBudget`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: models/enums exactly as named in the spec's Prisma block —
  Task 4/5 read/write these verbatim field names.

- [ ] **Step 1: Thêm 2 enum `FinanceTransactionType { INCOME EXPENSE }`
      và `FinanceRecurringCycle { WEEKLY MONTHLY }`** gần các enum khác
      cuối file.

- [ ] **Step 2: Thêm model `FinanceTransaction`, `FinanceRecurringRule`,
      `FinanceBudget`** đúng như khối Prisma trong spec (section "Mô
      hình dữ liệu") — copy nguyên văn tên field, kiểu, index, unique.

- [ ] **Step 3: Thêm 3 relation vào `model User`**: `financeTransactions
      FinanceTransaction[]`, `financeRecurringRules
      FinanceRecurringRule[]`, `financeBudgets FinanceBudget[]` (cạnh các
      relation khác, không đổi thứ tự field hiện có).

- [ ] **Step 4: Xin xác nhận người dùng rồi chạy `npx prisma db push`,
      sau đó `npx prisma generate`**

- [ ] **Step 5: `npx tsc --noEmit`** — kỳ vọng sạch (chỉ thêm, không đổi
      API hiện có).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add finance transaction, recurring rule, and budget models"
```

---

### Task 2: `src/lib/dates.ts` — `addMonths`

**Files:**
- Modify: `src/lib/dates.ts`
- Create: `src/lib/dates.test.ts`

**Interfaces:**
- Produces: `addMonths(iso: ISODate, n: number): ISODate` — Task 3's
  `nextRunDateFor` calls this for the `MONTHLY` cycle.

- [ ] **Step 1: Write the failing tests** in new `src/lib/dates.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { addMonths } from "./dates";

test("addMonths advances the month, keeping the day", () => {
  assert.equal(addMonths("2026-01-15", 1), "2026-02-15");
});

test("addMonths clamps an overflowing day to the target month's last day", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
});

test("addMonths rolls the year over", () => {
  assert.equal(addMonths("2026-12-05", 1), "2027-01-05");
});
```

- [ ] **Step 2: Run `npm test -- --test-name-pattern addMonths` (or
      `npx tsx --test src/lib/dates.test.ts`) to verify it fails** —
      expected: `addMonths is not a function`.

- [ ] **Step 3: Implement `addMonths(iso: ISODate, n: number): ISODate`
      in `src/lib/dates.ts`** (cạnh `addDays`) — dùng `toDbDate`/
      `fromDbDate` như các hàm khác trong file; tính ngày cuối tháng đích
      (`new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()`)
      và lấy `Math.min(originalDay, lastDayOfTargetMonth)` để tránh lỗi
      tràn tháng tự nhiên của `setUTCMonth` (vd. 31/1 + 1 tháng không
      được nhảy sang 3/3).

- [ ] **Step 4: Run tests, verify pass**

Run: `npx tsx --test src/lib/dates.test.ts`
Expected: 3 pass.

- [ ] **Step 5: `npx tsc --noEmit`**

- [ ] **Step 6: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat(dates): add addMonths with end-of-month clamping"
```

---

### Task 3: `src/lib/finance.ts` — pure budget/recurring calc

**Files:**
- Create: `src/lib/finance.ts`
- Create: `src/lib/finance.test.ts`

**Interfaces:**
- Consumes: `addDays`, `addMonths` (Task 2), `ISODate` type.
- Produces: `type BudgetWarningLevel = "NONE" | "WARN_80" | "WARN_90" |
  "OVER_100"`; `budgetWarningLevel(spentVnd: number, limitVnd: number):
  BudgetWarningLevel`; `nextRunDateFor(cycle: "WEEKLY" | "MONTHLY", from:
  ISODate): ISODate` — Task 4's `runDueRecurringRules` and Task 5's
  `createFinanceTransaction` call these by name.

- [ ] **Step 1: Write the failing tests** in new `src/lib/finance.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { budgetWarningLevel, nextRunDateFor } from "./finance";

test("budgetWarningLevel is NONE with no budget set (limit 0)", () => {
  assert.equal(budgetWarningLevel(500_000, 0), "NONE");
});
test("budgetWarningLevel is NONE below 80%", () => {
  assert.equal(budgetWarningLevel(700_000, 1_000_000), "NONE");
});
test("budgetWarningLevel is WARN_80 at exactly 80%", () => {
  assert.equal(budgetWarningLevel(800_000, 1_000_000), "WARN_80");
});
test("budgetWarningLevel is WARN_90 at exactly 90%", () => {
  assert.equal(budgetWarningLevel(900_000, 1_000_000), "WARN_90");
});
test("budgetWarningLevel is OVER_100 at or past the limit", () => {
  assert.equal(budgetWarningLevel(1_000_000, 1_000_000), "OVER_100");
  assert.equal(budgetWarningLevel(1_500_000, 1_000_000), "OVER_100");
});

test("nextRunDateFor WEEKLY adds 7 days", () => {
  assert.equal(nextRunDateFor("WEEKLY", "2026-11-01"), "2026-11-08");
});
test("nextRunDateFor MONTHLY adds 1 month", () => {
  assert.equal(nextRunDateFor("MONTHLY", "2026-01-31"), "2026-02-28");
});
```

- [ ] **Step 2: Run tests to verify they fail** —
      `npx tsx --test src/lib/finance.test.ts` — expected: module not
      found.

- [ ] **Step 3: Implement both functions in `src/lib/finance.ts`** —
      `budgetWarningLevel` is a plain ratio check in the order
      `OVER_100` → `WARN_90` → `WARN_80` → `NONE` (guard `limitVnd <= 0`
      first); `nextRunDateFor` dispatches to `addDays(from, 7)` or
      `addMonths(from, 1)`.

- [ ] **Step 4: Run tests, verify pass**

Run: `npx tsx --test src/lib/finance.test.ts`
Expected: 7 pass.

- [ ] **Step 5: `npx tsc --noEmit`**

- [ ] **Step 6: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat(finance): add pure budget-warning and recurring-cycle helpers"
```

---

### Task 4: `src/lib/finance-queries.ts` — dashboard read + recurring catch-up

**Files:**
- Create: `src/lib/finance-queries.ts`

**Interfaces:**
- Consumes: Task 1's models; Task 3's `budgetWarningLevel`,
  `nextRunDateFor`; `monthBounds`, `toDbDate`, `todayISO`, `isoInZone`
  from `src/lib/dates.ts`.
- Produces: `getFinanceDashboard(userId: string, timezone: string):
  Promise<FinanceDashboard>` (shape: `{ incomeThisMonth: number;
  expenseThisMonth: number; budgets: { category: string; limitVnd:
  number; spentVnd: number; level: BudgetWarningLevel }[];
  recentTransactions: (serialized FinanceTransaction, newest 20)[];
  recurringRules: (serialized FinanceRecurringRule, active first)[] }`)
  and `runDueRecurringRules(userId: string, timezone: string, throughAt =
  new Date()): Promise<number>` — Task 5's actions and Task 7's page
  call these by name; Task 7 reads exactly this shape. Also produces
  `getTodayVariableExpenses(userId: string, timezone: string):
  Promise<{ totalVnd: number; entries: { id: string; amountVnd: number;
  note: string | null }[] }>` — Task 9's `journey/page.tsx` calls this by
  name.

- [ ] **Step 1: Implement `runDueRecurringRules(userId, timezone,
      throughAt)`**:
      - `const today = isoInZone(throughAt, timezone);`
      - `db.financeRecurringRule.findMany({ where: { userId, active:
        true, nextRunDate: { lte: toDbDate(today) } } })`.
      - Nếu rỗng, `return 0`.
      - Với mỗi rule: lặp `while (nextRunIso <= today)`:
        1. Tạo `FinanceTransaction` (`type: rule.type, amountVnd:
           rule.amountVnd, category: rule.category, accountName:
           rule.accountName, note: rule.note, occurredAt:
           toDbDate(nextRunIso), recurringRuleId: rule.id, userId`).
        2. Nếu `rule.type === "EXPENSE" && rule.category`: SAU KHI đã tạo
           giao dịch ở bước 1, `db.financeBudget.findUnique({ where: {
           userId_category: { userId, category: rule.category } } })`;
           nếu không có row này, bỏ qua bước cảnh báo (không có ngân
           sách cho category này); nếu có, chạy 1 `aggregate` mới tính
           tổng chi category đó trong tháng chứa `nextRunIso` (dùng
           `monthBounds` trên `nextRunIso`'s year/month) — tổng này tự
           nhiên đã bao gồm giao dịch vừa tạo ở bước 1, không cộng tay;
           gọi `budgetWarningLevel(spentVnd, budget.monthlyLimitVnd)`.
        3. Nếu bước 2 chạy và trả khác `"NONE"`: `db.notification.create({
           data: { userId, actorId: null, type: "FINANCE_BUDGET_WARNING",
           title: `Chi phí cố định vừa cập nhật ngân sách "${rule.category}"`,
           body: level === "OVER_100" ? `Đã vượt quá hạn mức tháng này.` :
           `Đã dùng ${level === "WARN_90" ? "90" : "80"}% hạn mức tháng
           này.`, href: "/finance" } })` (chuỗi tiếng Việt cố định, theo
           đúng quy ước notification hiện có trong `src/actions/work.ts`
           — không qua i18n, vì nội dung thông báo được lưu thẳng vào DB,
           không phải copy UI render trực tiếp).
        4. `nextRunIso = nextRunDateFor(rule.cycle, nextRunIso)`; đếm số
           giao dịch đã tạo.
      - Sau vòng lặp của 1 rule, `db.financeRecurringRule.update({ where:
        { id: rule.id }, data: { nextRunDate: toDbDate(nextRunIso) } })`.
      - Trả tổng số giao dịch đã tạo trên mọi rule.

- [ ] **Step 2: Implement `getFinanceDashboard(userId, timezone)`**:
      - `today = isoInZone(new Date(), timezone)`, parse năm/tháng từ đó,
        `monthBounds(year, month)`.
      - `db.financeTransaction.groupBy({ by: ["type"], where: { userId,
        occurredAt: { gte: toDbDate(from), lte: toDbDate(to) } }, _sum:
        { amountVnd: true } })` → `incomeThisMonth`/`expenseThisMonth`
        (0 nếu không có dòng nào).
      - `db.financeBudget.findMany({ where: { userId } })`; với mỗi,
        `db.financeTransaction.aggregate({ where: { userId, type:
        "EXPENSE", category: b.category, occurredAt: { gte:
        toDbDate(from), lte: toDbDate(to) } }, _sum: { amountVnd: true }
        })` → `spentVnd`; `level = budgetWarningLevel(spentVnd,
        b.monthlyLimitVnd)`.
      - `db.financeTransaction.findMany({ where: { userId }, orderBy: {
        occurredAt: "desc" }, take: 20 })`.
      - `db.financeRecurringRule.findMany({ where: { userId }, orderBy:
        [{ active: "desc" }, { nextRunDate: "asc" }] })`.
      - Serialize `Date` fields to ISO strings for client use (giống
        cách `page.tsx` khác serialize trước khi truyền cho client
        component).

- [ ] **Step 3: Implement `getTodayVariableExpenses(userId, timezone)`**:
      - `today = isoInZone(new Date(), timezone)`.
      - `db.financeTransaction.findMany({ where: { userId, type:
        "EXPENSE", recurringRuleId: null, occurredAt: toDbDate(today) },
        orderBy: { createdAt: "desc" }, select: { id: true, amountVnd:
        true, note: true } })`.
      - `totalVnd = entries.reduce((sum, e) => sum + e.amountVnd, 0)`.
      - Trả `{ totalVnd, entries }`.

- [ ] **Step 4: `npx tsc --noEmit`**

- [ ] **Step 5: `npm test`** — vẫn xanh (file này không có unit test
      riêng theo quy ước repo, DB-coupled).

- [ ] **Step 6: Commit**

```bash
git add src/lib/finance-queries.ts
git commit -m "feat(finance): add dashboard read, recurring-rule catch-up, and today's variable-expense read"
```

---

### Task 5: `src/actions/finance.ts` — server actions

**Files:**
- Create: `src/actions/finance.ts`

**Interfaces:**
- Consumes: `run`, `UserError` (`@/lib/action`), `requireUser`
  (`@/lib/session`), Task 3's `budgetWarningLevel`, Task 4's shape
  conventions, `monthBounds`/`toDbDate`/`isoInZone` (`@/lib/dates`).
- Produces: `createFinanceTransaction(input): Promise<Result<{ warning:
  BudgetWarningLevel }>>`, `upsertFinanceBudget(input):
  Promise<Result<void>>`, `createFinanceRecurringRule(input):
  Promise<Result<void>>`, `toggleFinanceRecurringRule(id: string):
  Promise<Result<void>>`, `deleteFinanceRecurringRule(id: string):
  Promise<Result<void>>`, `deleteFinanceTransaction(id: string):
  Promise<Result<void>>` — Task 7's `finance-controls.tsx` calls these
  exact names.

- [ ] **Step 1: Define zod schemas** — `transactionSchema`: `type:
      z.enum(["INCOME", "EXPENSE"])`, `amountVnd:
      z.coerce.number().int().min(1).max(1_000_000_000)`, `category:
      z.string().trim().min(1).max(60).optional()`, `accountName:
      z.string().trim().max(60).optional()`, `note:
      z.string().trim().max(200).optional()`, `occurredAt:
      z.string().refine(isValidISO, "VALIDATION")`. `recurringRuleSchema`:
      same fields minus `occurredAt`, plus `cycle: z.enum(["WEEKLY",
      "MONTHLY"])`, `startDate: z.string().refine(isValidISO,
      "VALIDATION")`. `budgetSchema`: `category:
      z.string().trim().min(1).max(60)`, `monthlyLimitVnd:
      z.coerce.number().int().min(0).max(1_000_000_000)`.

- [ ] **Step 2: Implement `createFinanceTransaction(input)`**:
      - `run(async () => { const user = await requireUser(); const data =
        transactionSchema.parse(input);`
      - Nếu `data.type === "EXPENSE" && !data.category` → throw
        `UserError("CATEGORY_REQUIRED")`.
      - `await db.financeTransaction.create({ data: { userId: user.id,
        type: data.type, amountVnd: data.amountVnd, category:
        data.category, accountName: data.accountName, note: data.note,
        occurredAt: toDbDate(data.occurredAt) } });`
      - Nếu `type === "INCOME"` → `revalidatePath("/finance"); return {
        warning: "NONE" as const };`
      - Nếu `type === "EXPENSE"`: tính `monthBounds` quanh
        `data.occurredAt`, `aggregate` tổng chi category đó trong tháng
        (bao gồm giao dịch vừa tạo), tra `FinanceBudget`, gọi
        `budgetWarningLevel`, `revalidatePath("/finance")`, trả
        `{ warning }`.

- [ ] **Step 3: Implement `upsertFinanceBudget(input)`** —
      `db.financeBudget.upsert({ where: { userId_category: { userId:
      user.id, category: data.category } }, create: { userId: user.id,
      category: data.category, monthlyLimitVnd: data.monthlyLimitVnd },
      update: { monthlyLimitVnd: data.monthlyLimitVnd } });
      revalidatePath("/finance");`

- [ ] **Step 4: Implement `createFinanceRecurringRule(input)`** —
      validate (same `CATEGORY_REQUIRED` rule for `EXPENSE`), `db.
      financeRecurringRule.create({ data: { userId: user.id, ...data,
      startDate: toDbDate(data.startDate), nextRunDate:
      toDbDate(data.startDate) } }); revalidatePath("/finance");`

- [ ] **Step 5: Implement `toggleFinanceRecurringRule(id)` /
      `deleteFinanceRecurringRule(id)` / `deleteFinanceTransaction(id)`**
      — mỗi hàm `requireUser()` rồi thao tác có điều kiện `where: { id,
      userId: user.id }` (không tìm thấy/không thuộc về user →
      `db.*.updateMany`/`deleteMany` trả `count: 0`, không throw — khớp
      mẫu ownership-check qua `updateMany`/`deleteMany` đã dùng ở các
      action file khác trong repo); toggle đảo `active`
      (`db.financeRecurringRule.update` sau khi đọc giá trị hiện tại, vì
      cần biết giá trị cũ để đảo); mỗi hàm `revalidatePath("/finance")`.

- [ ] **Step 6: `npx tsc --noEmit`** — lỗi mong đợi duy nhất: không có
      (action file này không tham chiếu `t.finance.*` — UI/i18n wiring
      cho `CATEGORY_REQUIRED` nằm ở Task 6).

- [ ] **Step 7: Commit**

```bash
git add src/actions/finance.ts
git commit -m "feat(finance): add transaction, budget, and recurring-rule actions"
```

---

### Task 6: i18n — `nav.finance` + `finance` dict + `CATEGORY_REQUIRED` mapping

**Files:**
- Modify: `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts`, `src/lib/use-action.ts`

**Interfaces:**
- Produces: `Dict["nav"]["finance"]`, `Dict["finance"].*` — Task 7's and
  Task 8's components reference these key names verbatim.

- [ ] **Step 1: Thêm `nav.finance`** vào cả 2 file: vi `"Tài chính"` / en
      `"Finance"`.

- [ ] **Step 2: Thêm dict `finance` top-level** với các key UI task 7 cần
      (chốt tên 1 lần, dùng xuyên suốt task 7): `title`, `subtitle`,
      `incomeThisMonth`, `expenseThisMonth`, `balanceThisMonth`,
      `addIncome`, `addExpense`, `amountLabel`, `categoryLabel`,
      `categoryPlaceholder`, `accountLabel`, `noteLabel`, `dateLabel`,
      `save`, `transactionSaved`, `budgetsTitle`, `budgetSpentOf` (dùng
      `fmt`, vd vi `"{spent} / {limit}"`), `noBudgetsYet`,
      `addOrEditBudget`, `budgetSaved`, `recurringTitle`,
      `addRecurring`, `cycleLabel`, `cycleWeekly`, `cycleMonthly`,
      `startDateLabel`, `recurringActive`, `recurringPaused`, `pause`,
      `resume`, `deleteRecurring`, `recurringSaved`, `recentTitle`,
      `emptyTransactions`, `delete`, `warnBudget80` (vd vi `"Đã dùng 80%
      ngân sách {category}"`), `warnBudget90`, `warnBudgetOver`,
      `categoryRequiredError` (vi "Vui lòng chọn danh mục cho khoản chi."
      / en "Please choose a category for this expense."),
      `expenseLoggedToday` (vi "Đã ghi nhận chi tiêu hôm nay." / en
      "Logged today's expense.", dùng ở Task 9's Journey quick-add),
      `spentTodayLabel` (vi "Đã chi hôm nay" / en "Spent today", dùng ở
      Task 9's tổng chi hôm nay) — thêm bằng cả tiếng Việt và Anh, nội
      dung tương đương, không hardcode ở component.

- [ ] **Step 3: Trong `src/lib/use-action.ts`'s `message()`, thêm mapping**
      `if (code === "CATEGORY_REQUIRED") return t.finance.categoryRequiredError;`
      (cạnh các `if` khác, trước dòng `return t.common.error`).

- [ ] **Step 4: `npx tsc --noEmit`** — kỳ vọng `en.ts` khớp shape với
      `vi.ts` (lỗi ở đây nghĩa là thiếu key tiếng Anh).

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/vi.ts src/lib/i18n/en.ts src/lib/use-action.ts
git commit -m "feat(i18n): add finance module strings and CATEGORY_REQUIRED mapping"
```

---

### Task 7: Route `/finance`

**Files:**
- Create: `src/app/(app)/finance/page.tsx`
- Create: `src/app/(app)/finance/finance-controls.tsx`

**Interfaces:**
- Consumes: Task 4's `getFinanceDashboard`/`runDueRecurringRules`, Task
  5's 6 actions, Task 6's `t.finance.*`, `t.nav.finance`.

- [ ] **Step 1: `page.tsx`** (server component, theo mẫu
      `journey/page.tsx`): `requireUser()`, `await
      runDueRecurringRules(user.id, user.timezone)`, `const dashboard =
      await getFinanceDashboard(user.id, user.timezone)`, render
      `<SplitHeading text={t.nav.finance} .../>` rồi
      `<FinanceControls dashboard={dashboard} />`. `export const metadata
      = { title: "Tài chính" }`. Giữ đúng opt-out Cache Components đang
      dùng ở các page DB-coupled khác trong repo (comment
      `@next-codemod-ignore` + `export const instant = false`) nếu
      `journey/page.tsx` cũng cần nó (đã có ở đó — copy y hệt comment đó
      vào file mới).

- [ ] **Step 2: `finance-controls.tsx`** ("use client", theo mẫu
      `journey-controls.tsx`): nhận `dashboard: FinanceDashboard` (type
      từ Task 4), dùng `useAction()` (`@/lib/use-action`) cho mọi action
      gọi:
      - 3 thẻ tổng quan (thu/chi/số dư tháng này) dùng class `card`
        hiện có, số tiền format qua `vnd()` đã có sẵn ở
        `src/lib/billing.ts` (`new Intl.NumberFormat("vi-VN").format(n) +
        "₫"`) — import và tái dùng, không viết hàm format tiền thứ hai.
      - Danh sách ngân sách: mỗi dòng `category` + `ProgressBar` (màu:
        `OVER_100` → `var(--danger)`, `WARN_90`/`WARN_80` → `var(--ochre)`,
        `NONE` → `var(--jade)`) + nút sửa hạn mức (mở input inline gọi
        `upsertFinanceBudget`).
      - Form "Thêm khoản thu" / "Thêm khoản chi": input số tiền, danh
        mục (chỉ `EXPENSE` bắt buộc, UI disable submit nếu rỗng ở nhánh
        chi), tài khoản, ngày (`type="date"`, mặc định hôm nay), ghi
        chú; import thêm `useToast` từ `@/components/ui/toast` (cạnh
        `useAction`) — `exec(() => createFinanceTransaction(...), {
        onSuccess: (data) => { refresh(); if (data.warning === "NONE")
        toast("success", t.finance.transactionSaved); else
        toast("error", t.finance.warnBudget80/90/Over tương ứng) } })`
        (không dùng tham số `success` tĩnh của `exec` cho nhánh chi, vì
        thông điệp phụ thuộc `data.warning`; nhánh thu vẫn dùng `success:
        t.finance.transactionSaved` như bình thường). `onSuccess` nhận
        thẳng `data` (kiểu trả về của action, không phải `Result` bọc
        ngoài — xem chữ ký `exec` trong `src/lib/use-action.ts`).
      - Danh sách rule định kỳ: tên (category hoặc "Thu nhập"/"Chi
        phí" + số tiền), badge active/paused, nút tạm dừng/tiếp tục
        (`toggleFinanceRecurringRule`), nút xoá
        (`deleteFinanceRecurringRule`) kèm xác nhận 2 bước (mẫu `deleteId`
        state giống `PersonalMissionControls` trong
        `journey-controls.tsx`); form thêm rule mới (loại, số tiền, danh
        mục, chu kỳ, ngày bắt đầu).
      - Danh sách giao dịch gần đây: bảng/list đơn giản, mỗi dòng có nút
        xoá (`deleteFinanceTransaction`) kèm xác nhận.

- [ ] **Step 3: `npx tsc --noEmit`**

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/finance"
git commit -m "feat(routes): add the /finance page with budgets, quick-add, and recurring rules"
```

---

### Task 8: Nav wiring

**Files:**
- Modify: `src/components/nav.tsx`

**Interfaces:**
- Consumes: Task 6's `nav.finance`.

- [ ] **Step 1: Thêm `{ href: "/finance", key: "finance", icon:
      Wallet }`** vào mảng `NAV` (import `Wallet` từ `lucide-react` nếu
      chưa có trong file này) — đặt cạnh `workspace`/`journey`, vị trí
      hợp lý theo thứ tự hiện có (không cần khớp artifact vì artifact
      không vẽ sidebar).

- [ ] **Step 2: `npx tsc --noEmit`**

- [ ] **Step 3: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat(nav): add Tài chính to the sidebar"
```

---

### Task 9: Nối "chi tiêu hôm nay" trong Hành trình 180 ngày với Finance

**Files:**
- Modify: `src/actions/journey.ts`
- Modify: `src/lib/journey-queries.ts`
- Modify: `src/app/(app)/journey/page.tsx`
- Modify: `src/app/(app)/journey/journey-controls.tsx`

**Interfaces:**
- Consumes: Task 4's `getTodayVariableExpenses`, Task 5's
  `createFinanceTransaction`/`deleteFinanceTransaction`.
- Produces: `JourneyControls`'s `expense` prop thay đổi type từ
  `{ amountVnd: number; note: string | null } | null` sang
  `{ totalVnd: number; entries: { id: string; amountVnd: number; note:
  string | null }[] }` (không còn `| null` — luôn có giá trị, rỗng là
  `{ totalVnd: 0, entries: [] }`).

- [ ] **Step 1: Xoá `saveJourneyExpense`** khỏi `src/actions/journey.ts`
      (không còn nơi nào gọi sau Step 4) — xoá cả `expenseSchema` nếu
      không dùng ở đâu khác trong file (kiểm tra bằng grep trước khi xoá).

- [ ] **Step 2: Trong `src/lib/journey-queries.ts`, bỏ `expense: true`
      khỏi `include` của `dayRecord`** trong `getJourneyDashboard`
      (model `JourneyExpenseEntry` giữ nguyên trong schema — đây chỉ là
      bỏ select, không xoá bảng/dữ liệu).

- [ ] **Step 3: Trong `src/app/(app)/journey/page.tsx`**, gọi
      `getTodayVariableExpenses(user.id, user.timezone)` song song với
      `getJourneyDashboard(user)` (`Promise.all`, theo đúng mẫu
      `Promise.all([getAccessibleBoards(...), getUserTeams(...), ...])`
      đã dùng ở `workspace/page.tsx`); truyền kết quả vào
      `<JourneyControls expense={...} .../>` thay cho
      `journey.dayRecord.expense ? {...} : null}` hiện tại.

- [ ] **Step 4: Trong `journey-controls.tsx`**:
      - Đổi type prop `expense` của `JourneyControls` thành shape ở
        Interfaces.
      - Bỏ `saveJourneyExpense` khỏi import, thêm
        `createFinanceTransaction`, `deleteFinanceTransaction` từ
        `@/actions/finance`.
      - Khối "TÀI CHÍNH · chi tiêu hôm nay": 2 input (số tiền, ghi chú) +
        nút "Thêm" gọi `exec(() => createFinanceTransaction({ type:
        "EXPENSE", amountVnd: Number(expenseAmount), note: expenseNote ||
        undefined, category: "Khác", occurredAt: today }), { success:
        t.finance.expenseLoggedToday, onSuccess: () => {
        setExpenseAmount(""); setExpenseNote(""); refresh(); } })` (prop
        `today: ISODate` đã có sẵn trên `JourneyControls`, dùng lại
        đúng field đó cho `occurredAt`); xoá input sau khi thêm thành
        công (không còn là ô "sửa 1 dòng" nữa, giờ là ô nhập rồi thêm
        mới).
      - Bên dưới danh sách `expense.entries` (nếu có): mỗi dòng hiện số
        tiền + ghi chú + nút xoá nhỏ gọi
        `exec(() => deleteFinanceTransaction(entry.id), { onSuccess:
        refresh })`.
      - Dòng tổng: `{t.finance.spentTodayLabel}: {vnd(expense.totalVnd)}`
        (import `vnd` từ `@/lib/billing`) thay cho ô input amount hiển
        thị giá trị đã lưu như cũ.
      - Cập nhật câu mô tả dưới form (hiện đang nói "phần quản lý chi
        tiêu đầy đủ... sẽ có sau") — bỏ câu đó, vì giờ `/finance` đã có
        sẵn; có thể thay bằng link ngắn tới `/finance` nếu muốn, không
        bắt buộc.

- [ ] **Step 5: `npx tsc --noEmit`** — kỳ vọng sạch.

- [ ] **Step 6: `npm test`**

- [ ] **Step 7: Xác minh thủ công qua dev server + Playwright**: mở
      `/journey`, thêm 2 khoản "chi tiêu hôm nay" khác nhau → cả 2 hiện
      trong danh sách, tổng cộng đúng; xoá 1 khoản → tổng giảm đúng; mở
      `/finance` → 2 khoản đó xuất hiện trong "giao dịch gần đây" với
      category "Khác" (xác nhận đúng là cùng 1 nguồn dữ liệu).

- [ ] **Step 8: Commit**

```bash
git add src/actions/journey.ts src/lib/journey-queries.ts "src/app/(app)/journey/page.tsx" "src/app/(app)/journey/journey-controls.tsx"
git commit -m "feat(journey): back today's variable-expense card with FinanceTransaction"
```

---

### Task 10: Whole-tree verification

**Files:** none (verification only)

- [ ] **Step 1: `npx tsc --noEmit`** — expected: 0 errors.

- [ ] **Step 2: `npm test`** — expected: all pass, including the new
      `dates.test.ts`/`finance.test.ts` suites.

- [ ] **Step 3: `npm run build`** — expected: succeeds, `/finance` listed
      among the built routes.

- [ ] **Step 4: Manual verification via dev server + Playwright**:
      - `/finance` renders with 0 income/0 expense/empty budgets/empty
        recurring/empty recent-transactions states.
      - Thêm 1 khoản thu → thẻ tổng thu cập nhật, xuất hiện trong danh
        sách gần đây.
      - Đặt hạn mức ngân sách 1 category, thêm chi tiêu category đó tới
        80%/90%/vượt 100% → đúng toast cảnh báo từng mức, thanh tiến
        trình đổi màu.
      - Thêm 1 rule định kỳ `MONTHLY` với ngày bắt đầu hôm qua → tải lại
        `/finance` → giao dịch tự sinh xuất hiện trong danh sách gần
        đây, `nextRunDate` đã nhảy sang kỳ sau (không sinh trùng khi tải
        lại lần 2).
      - Thẻ "chi tiêu hôm nay" trong `/journey` vẫn hoạt động đúng sau
        khi 2 route cùng đọc/ghi chung `FinanceTransaction` (thêm ở
        `/journey`, thấy ở `/finance` và ngược lại).
      - Tạm dừng 1 rule → tải lại trang → rule không tự sinh giao dịch
        nữa dù đã tới hạn.
      - Sidebar có mục "Tài chính" dẫn đúng `/finance`.

- [ ] **Step 5: Nếu có vấn đề phát sinh, sửa rồi lặp lại Step 1–4; khi
      sạch, không cần commit thêm (các task trước đã commit đủ).**
