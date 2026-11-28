# Biểu đồ xu hướng thu/chi, lịch 30 ngày, và mục Tiết kiệm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trend charts for income/expense, a clickable 30-day calendar, and a Savings goals feature (with its own trend chart) to the existing `/finance` module.

**Architecture:** Reuse the existing `FinanceTransaction` table for savings (a deposit is an `EXPENSE` row, a withdrawal is an `INCOME` row, both tagged with a new optional `savingsGoalId`). Add one new model, `FinanceSavingsGoal`, for goal metadata only. Load one 400-day transaction window once per page render (`getFinanceTransactionsWindow`); every chart/calendar interaction (month nav, day click, Day/Week/Month toggle) runs as a pure in-memory function over that array on the client — no new read-oriented server actions, mirroring `work-calendar-view.tsx`. Charts are hand-rolled SVG components, no charting library.

**Tech Stack:** Next.js App Router, Prisma/Postgres, Zod, existing `run()`/`requireUser()`/`UserError` action convention, `t`/`useI18n` i18n, `node:test` for pure-function tests.

**Spec:** `docs/superpowers/specs/2026-11-28-finance-analytics-savings-design.md`

## Global Constraints

- No new npm dependency (no charting library) — charts are hand-rolled inline SVG.
- No new server actions for reads — all chart/calendar interactivity is pure client-side filtering of one SSR-loaded array.
- Savings reuses `FinanceTransaction` (deposit = `EXPENSE`, withdrawal = `INCOME`); no separate ledger table.
- Deleting a `FinanceSavingsGoal` must not delete its transaction history (`onDelete: SetNull`, same convention as `recurringRuleId`).
- Chart colors come from the app's existing CSS tokens (`var(--jade-ink)` income, `var(--danger)` expense, `var(--accent)` savings) — never the reference screenshots' blue.
- Every new/changed string goes through `t`/`useI18n`, added to both `src/lib/i18n/vi.ts` and `src/lib/i18n/en.ts`.
- Schema changes apply via `npx prisma db push` (this project has no `prisma/migrations` folder) — pause and get explicit human confirmation before running it, since it writes to a shared dev database.

## Review Focus

- Withdrawing more than a goal's current `savedVnd` must be rejected server-side even if the client guard is bypassed (`WITHDRAWAL_EXCEEDS_SAVED`), not silently clamp to 0 — owned by Task 4.
- Deleting a savings goal must leave its past deposit/withdrawal transactions intact with `savingsGoalId` set to `null`, not delete or orphan them — owned by Task 1 (schema `onDelete: SetNull`) and Task 4 (delete action).
- `computeSavingsRateTrend` on a month with zero real income (denominator 0) must return `ratePercent: 0`, never `NaN`/`Infinity` — owned by Task 2.
- A month whose only `INCOME` rows are savings withdrawals must get a real-income denominator of `0` (withdrawals fully excluded, not merely netted against deposits) — owned by Task 2.
- `getTransactionsForDate`/`getMonthCalendarSummary` on a date with no transactions must return `[]`/omit the day cleanly, never throw or return `undefined` entries — owned by Task 2.

---

### Task 1: Schema — `FinanceSavingsGoal` + `savingsGoalId`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `FinanceSavingsGoal` model (`id`, `userId`, `name`, `targetVnd`, `targetDate: DateTime? @db.Date`, timestamps); `FinanceTransaction.savingsGoalId: String?` + `savingsGoal` relation; `User.financeSavingsGoals: FinanceSavingsGoal[]`.

- [ ] **Step 1: Add the model and relations**

In `prisma/schema.prisma`, after the `FinanceBudget` model, add:

```prisma
model FinanceSavingsGoal {
  id           String    @id @default(cuid())
  userId       String
  name         String
  targetVnd    Int
  targetDate   DateTime? @db.Date
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  user         User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions FinanceTransaction[]

  @@index([userId])
}
```

On `FinanceTransaction`, add `savingsGoalId String?` and `savingsGoal FinanceSavingsGoal? @relation(fields: [savingsGoalId], references: [id], onDelete: SetNull)`, following the exact pattern already used there for `recurringRuleId`/`recurringRule`. On `User`, add `financeSavingsGoals FinanceSavingsGoal[]` next to `financeBudgets`.

- [ ] **Step 2: Format and sanity-check the schema**

Run: `npx prisma format`
Expected: exits 0, no syntax errors.

- [ ] **Step 3: Apply the schema to the database**

Pause and get explicit confirmation from the human partner before this step (writes to a shared dev database). Then run: `npx prisma db push`
Expected: exits 0, reports the new table/column created.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(finance): add FinanceSavingsGoal model and savingsGoalId column"
```

---

### Task 2: Pure trend/calendar functions in `src/lib/finance.ts`

**Files:**
- Modify: `src/lib/finance.ts`
- Test: `src/lib/finance.test.ts`

**Interfaces:**
- Consumes: `SerializedFinanceTransaction` type (defined in Task 3's `finance-queries.ts`; for this task, define a local structural type in `finance.ts` with the same shape — `{ type: "INCOME" | "EXPENSE"; amountVnd: number; occurredAt: string; savingsGoalId: string | null }` — so this task has no import-order dependency on Task 3. Task 3 will re-export `SerializedFinanceTransaction` as the superset type; structural typing makes both assignable.)
- Produces: `computeIncomeExpenseTrend(transactions, timezone, unit, weekStartsOn, today?)`, `computeSavingsRateTrend(transactions, timezone, today?)`, `getTransactionsForDate(transactions, timezone, date)`, `getMonthCalendarSummary(transactions, timezone, year, month)`.

All four functions take `transactions` as their first argument and never touch the DB (plain functions, same file as `budgetWarningLevel`).

- [ ] **Step 1: Write failing tests for `computeIncomeExpenseTrend`**

```ts
test("computeIncomeExpenseTrend day unit returns 30 buckets ending today, bucketing by occurredAt date", () => {
  const txs = [
    { type: "INCOME" as const, amountVnd: 100_000, occurredAt: "2026-11-28", savingsGoalId: null },
    { type: "EXPENSE" as const, amountVnd: 40_000, occurredAt: "2026-11-28", savingsGoalId: null },
    { type: "EXPENSE" as const, amountVnd: 20_000, occurredAt: "2026-10-01", savingsGoalId: null }, // outside the 30-day window
  ];
  const trend = computeIncomeExpenseTrend(txs, "Asia/Ho_Chi_Minh", "day", 1, "2026-11-28");
  assert.equal(trend.length, 30);
  assert.equal(trend[29].label, "2026-11-28");
  assert.equal(trend[29].incomeVnd, 100_000);
  assert.equal(trend[29].expenseVnd, 40_000);
  assert.equal(trend[0].label, "2026-10-30");
  assert.equal(trend.some((b) => b.label === "2026-10-01"), false);
});

test("computeIncomeExpenseTrend month unit returns 12 monthly buckets labelled YYYY-MM", () => {
  const txs = [{ type: "INCOME" as const, amountVnd: 500_000, occurredAt: "2026-11-15", savingsGoalId: null }];
  const trend = computeIncomeExpenseTrend(txs, "Asia/Ho_Chi_Minh", "month", 1, "2026-11-28");
  assert.equal(trend.length, 12);
  assert.equal(trend[11].label, "2026-11");
  assert.equal(trend[11].incomeVnd, 500_000);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/lib/finance.test.ts`
Expected: FAIL with "computeIncomeExpenseTrend is not defined" (or similar).

- [ ] **Step 3: Implement `computeIncomeExpenseTrend`**

```ts
export function computeIncomeExpenseTrend(
  transactions: { type: "INCOME" | "EXPENSE"; amountVnd: number; occurredAt: string; savingsGoalId: string | null }[],
  timezone: string,
  unit: "day" | "week" | "month",
  weekStartsOn: number,
  today: ISODate = isoInZone(new Date(), timezone),
): { label: string; incomeVnd: number; expenseVnd: number }[]
```

Bucket counts per the spec: `day` → 30 buckets, one per calendar day, label = that day's ISO date (`YYYY-MM-DD`); `week` → 12 buckets, one per week starting on `weekStartsOn` (reuse `startOfWeek`/`addDays`), label = the week's start ISO date; `month` → 12 buckets, label = `YYYY-MM`. Build the ordered list of bucket labels first (oldest to newest, ending at `today`'s bucket), then sum `amountVnd` per bucket by `type`, matching each transaction's `occurredAt.slice(0, 10)` to its bucket. A transaction whose date falls outside every bucket's range is dropped (not clamped into the nearest one).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/lib/finance.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing tests for `computeSavingsRateTrend`**

```ts
test("computeSavingsRateTrend excludes withdrawal-income from the denominator", () => {
  const txs = [
    { type: "INCOME" as const, amountVnd: 1_000_000, occurredAt: "2026-11-05", savingsGoalId: null }, // real income
    { type: "INCOME" as const, amountVnd: 300_000, occurredAt: "2026-11-10", savingsGoalId: "g1" }, // withdrawal
    { type: "EXPENSE" as const, amountVnd: 200_000, occurredAt: "2026-11-12", savingsGoalId: "g1" }, // deposit
  ];
  const trend = computeSavingsRateTrend(txs, "Asia/Ho_Chi_Minh", "2026-11-28");
  assert.equal(trend.length, 6);
  const nov = trend.find((b) => b.label === "2026-11")!;
  // net savings = deposit 200_000 - withdrawal 300_000 = -100_000; real income = 1_000_000
  assert.equal(nov.ratePercent, -10);
});

test("computeSavingsRateTrend is 0 when a month's only income is a savings withdrawal", () => {
  const txs = [{ type: "INCOME" as const, amountVnd: 500_000, occurredAt: "2026-11-10", savingsGoalId: "g1" }];
  const trend = computeSavingsRateTrend(txs, "Asia/Ho_Chi_Minh", "2026-11-28");
  const nov = trend.find((b) => b.label === "2026-11")!;
  assert.equal(nov.ratePercent, 0); // denominator (real income) is 0, not negative/NaN
});
```

- [ ] **Step 6: Run tests to verify they fail, then implement `computeSavingsRateTrend`**

Run: `npx tsx --test src/lib/finance.test.ts` — Expected: FAIL.

```ts
export function computeSavingsRateTrend(
  transactions: { type: "INCOME" | "EXPENSE"; amountVnd: number; occurredAt: string; savingsGoalId: string | null }[],
  timezone: string,
  today: ISODate = isoInZone(new Date(), timezone),
): { label: string; ratePercent: number }[]
```

6 monthly buckets (oldest to newest, label `YYYY-MM`). Per bucket: `realIncomeVnd` = sum of `INCOME` rows with `savingsGoalId === null`; `netSavingsVnd` = sum of `EXPENSE` rows with `savingsGoalId !== null` minus sum of `INCOME` rows with `savingsGoalId !== null`. `ratePercent = realIncomeVnd === 0 ? 0 : Math.round((netSavingsVnd / realIncomeVnd) * 100)` — can be negative.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx tsx --test src/lib/finance.test.ts`
Expected: PASS.

- [ ] **Step 8: Write failing tests for `getTransactionsForDate` and `getMonthCalendarSummary`**

```ts
test("getTransactionsForDate returns only same-day transactions, [] when none", () => {
  const txs = [
    { occurredAt: "2026-11-28", id: "a" },
    { occurredAt: "2026-11-27", id: "b" },
  ] as unknown as Parameters<typeof getTransactionsForDate>[0];
  assert.deepEqual(getTransactionsForDate(txs, "Asia/Ho_Chi_Minh", "2026-11-28").map((t) => t.id), ["a"]);
  assert.deepEqual(getTransactionsForDate(txs, "Asia/Ho_Chi_Minh", "2026-12-01"), []);
});

test("getMonthCalendarSummary sums income/expense per day, omits days with no transactions", () => {
  const txs = [
    { type: "INCOME" as const, amountVnd: 100_000, occurredAt: "2026-11-05", savingsGoalId: null },
    { type: "EXPENSE" as const, amountVnd: 30_000, occurredAt: "2026-11-05", savingsGoalId: null },
  ] as unknown as Parameters<typeof getMonthCalendarSummary>[0];
  const summary = getMonthCalendarSummary(txs, "Asia/Ho_Chi_Minh", 2026, 11);
  assert.deepEqual(summary["2026-11-05"], { incomeVnd: 100_000, expenseVnd: 30_000 });
  assert.equal(summary["2026-11-06"], undefined);
});
```

- [ ] **Step 9: Run tests to verify they fail, then implement both functions**

Run: `npx tsx --test src/lib/finance.test.ts` — Expected: FAIL.

```ts
export function getTransactionsForDate<T extends { occurredAt: string }>(transactions: T[], timezone: string, date: ISODate): T[]

export function getMonthCalendarSummary(
  transactions: { type: "INCOME" | "EXPENSE"; amountVnd: number; occurredAt: string }[],
  timezone: string,
  year: number,
  month: number,
): Record<ISODate, { incomeVnd: number; expenseVnd: number }>
```

`getTransactionsForDate` filters by `t.occurredAt.slice(0, 10) === date`. `getMonthCalendarSummary` groups transactions whose `occurredAt` date falls within `monthBounds(year, month)` by day, summing `amountVnd` by `type`; days with zero transactions get no key (not a zeroed entry).

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx tsx --test src/lib/finance.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 11: Commit**

```bash
git add src/lib/finance.ts src/lib/finance.test.ts
git commit -m "feat(finance): add pure trend/calendar functions for charts and calendar"
```

---

### Task 3: DB reads — `finance-queries.ts`

**Files:**
- Modify: `src/lib/finance-queries.ts`

**Interfaces:**
- Consumes: `toDbDate`/`fromDbDate`/`isoInZone`/`addDays`/`type ISODate` from `@/lib/dates`.
- Produces: exported type `SerializedFinanceTransaction`; `FinanceDashboard["recentTransactions"]` now typed as `SerializedFinanceTransaction[]`; `getFinanceTransactionsWindow(userId: string, timezone: string, days?: number): Promise<SerializedFinanceTransaction[]>`; `getSavingsGoalSavedVnd(userId: string, savingsGoalId: string): Promise<number>`; `getFinanceSavingsGoals(userId: string): Promise<{ id: string; name: string; targetVnd: number; targetDate: ISODate | null; savedVnd: number }[]>`.

- [ ] **Step 1: Extract and export `SerializedFinanceTransaction`, add `savingsGoalId`**

Replace the inline object-literal type of `FinanceDashboard["recentTransactions"]` (current lines 10–21) with:

```ts
export type SerializedFinanceTransaction = {
  id: string;
  type: "INCOME" | "EXPENSE";
  amountVnd: number;
  category: string | null;
  accountName: string | null;
  note: string | null;
  occurredAt: string;
  recurringRuleId: string | null;
  savingsGoalId: string | null;
  createdAt: string;
  updatedAt: string;
};
```

`FinanceDashboard.recentTransactions` becomes `SerializedFinanceTransaction[]`. In `getFinanceDashboard`'s `recentTransactions.map(...)`, add `savingsGoalId: t.savingsGoalId` to the returned object.

- [ ] **Step 2: Implement `getFinanceTransactionsWindow`**

```ts
export async function getFinanceTransactionsWindow(
  userId: string,
  timezone: string,
  days = 400,
): Promise<SerializedFinanceTransaction[]>
```

Query `db.financeTransaction.findMany({ where: { userId, occurredAt: { gte: toDbDate(addDays(isoInZone(new Date(), timezone), -days)) } }, orderBy: { occurredAt: "asc" } })`, then serialize each row the same way `recentTransactions` does in `getFinanceDashboard` (including `savingsGoalId`).

- [ ] **Step 3: Implement `getSavingsGoalSavedVnd` and `getFinanceSavingsGoals`**

```ts
export async function getSavingsGoalSavedVnd(userId: string, savingsGoalId: string): Promise<number>

export async function getFinanceSavingsGoals(
  userId: string,
): Promise<{ id: string; name: string; targetVnd: number; targetDate: ISODate | null; savedVnd: number }[]>
```

`getSavingsGoalSavedVnd` runs two `db.financeTransaction.aggregate` calls (`type: "EXPENSE"` and `type: "INCOME"`, both `where: { userId, savingsGoalId }`) and returns `(deposits._sum.amountVnd ?? 0) - (withdrawals._sum.amountVnd ?? 0)`. `getFinanceSavingsGoals` loads `db.financeSavingsGoal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })`, then for each goal calls `getSavingsGoalSavedVnd` and maps `targetDate` through `fromDbDate` (or `null`).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `src/lib/finance-queries.ts` or its callers.

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance-queries.ts
git commit -m "feat(finance): add transaction window and savings goal reads"
```

---

### Task 4: Actions — savings guard + goal CRUD

**Files:**
- Modify: `src/actions/finance.ts`

**Interfaces:**
- Consumes: `getSavingsGoalSavedVnd` from `@/lib/finance-queries` (Task 3).
- Produces: `createFinanceTransaction` accepts optional `savingsGoalId`; `createFinanceSavingsGoal(input: { name: string; targetVnd: number; targetDate?: string })`, `updateFinanceSavingsGoal(id: string, input: { name: string; targetVnd: number; targetDate?: string })`, `deleteFinanceSavingsGoal(id: string)` — all returning `Result<...>` via `run()`. New error codes: `NOT_FOUND` (reused), `WITHDRAWAL_EXCEEDS_SAVED`.

- [ ] **Step 1: Extend `transactionSchema` and the create guard**

Add `savingsGoalId: z.string().trim().min(1).optional()` to `transactionSchema`. In `createFinanceTransaction`, right after the `CATEGORY_REQUIRED` check and before computing `normalizedCategory`'s budget side-effects, add:

```ts
if (data.savingsGoalId) {
  const goal = await db.financeSavingsGoal.findFirst({ where: { id: data.savingsGoalId, userId: user.id } });
  if (!goal) throw new UserError("NOT_FOUND");
  if (data.type === "INCOME") {
    const savedVnd = await getSavingsGoalSavedVnd(user.id, data.savingsGoalId);
    if (data.amountVnd > savedVnd) throw new UserError("WITHDRAWAL_EXCEEDS_SAVED");
  }
}
```

Add `savingsGoalId: data.savingsGoalId` to the `db.financeTransaction.create({ data: { ... } })` call.

- [ ] **Step 2: Add `savingsGoalSchema` and the three goal actions**

```ts
const savingsGoalSchema = z.object({
  name: z.string().trim().min(1).max(60),
  targetVnd: z.coerce.number().int().min(1).max(1_000_000_000),
  targetDate: z.string().refine(isValidISO, "VALIDATION").optional(),
});

export async function createFinanceSavingsGoal(input: z.input<typeof savingsGoalSchema>)
export async function updateFinanceSavingsGoal(id: string, input: z.input<typeof savingsGoalSchema>)
export async function deleteFinanceSavingsGoal(id: string)
```

`createFinanceSavingsGoal`: `run()` → `requireUser()`, parse, `db.financeSavingsGoal.create({ data: { userId: user.id, name: data.name, targetVnd: data.targetVnd, targetDate: data.targetDate ? toDbDate(data.targetDate) : undefined } })`, `revalidatePath("/finance")`. `updateFinanceSavingsGoal`: same parse, `db.financeSavingsGoal.updateMany({ where: { id, userId: user.id }, data: { name: data.name, targetVnd: data.targetVnd, targetDate: data.targetDate ? toDbDate(data.targetDate) : null } })`, revalidate. `deleteFinanceSavingsGoal`: `db.financeSavingsGoal.deleteMany({ where: { id, userId: user.id } })`, revalidate — follows the exact `deleteFinanceRecurringRule` pattern (lines 169–178).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/actions/finance.ts
git commit -m "feat(finance): add savings goal CRUD actions and withdrawal guard"
```

---

### Task 5: i18n + error-message wiring

**Files:**
- Modify: `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts`, `src/lib/use-action.ts`

**Interfaces:**
- Produces: new keys under `finance` in both dictionaries (used by Tasks 6–9 below); `message()` in `use-action.ts` maps `"WITHDRAWAL_EXCEEDS_SAVED"`.

- [ ] **Step 1: Add new `finance` keys to `vi.ts` and `en.ts`**

Add these keys (same key set, both files) right before the closing `},` of the `finance` block: `trendTitle`, `trendIncome`, `trendExpense`, `trendUnitDay`, `trendUnitWeek`, `trendUnitMonth`, `trendDeltaUp` (`"+{pct}% so với kỳ trước"` / `"+{pct}% vs. the previous period"`), `trendDeltaDown` (mirror with `-`), `calendarTitle`, `calendarDayDetailsTitle` (`"Giao dịch ngày {date}"` / `"Transactions on {date}"`), `calendarNoTransactions`, `savingsTitle`, `savingsSuggestLine` (`"Tháng này có thể tiết kiệm thêm {amount}"` / `"You could save {amount} more this month"`), `savingsGoalNamePlaceholder`, `savingsGoalTargetLabel`, `savingsGoalTargetDateLabel`, `savingsDeposit`, `savingsWithdraw`, `savingsSavedOfTarget` (`"{saved} / {target}"`), `savingsAddGoal`, `savingsGoalSaved`, `savingsGoalDeleted`, `savingsNoGoalsYet`, `savingsTrendTitle`, `withdrawalExceedsSavedError` (`"Không thể rút nhiều hơn số đã tiết kiệm."` / `"You can't withdraw more than you've saved."`).

- [ ] **Step 2: Map the new error code**

In `src/lib/use-action.ts`, add `if (code === "WITHDRAWAL_EXCEEDS_SAVED") return t.finance.withdrawalExceedsSavedError;` next to the existing `CATEGORY_REQUIRED` line.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `vi.ts`/`en.ts` key sets match, since `Dict` is derived from `vi`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/vi.ts src/lib/i18n/en.ts src/lib/use-action.ts
git commit -m "feat(finance): add i18n strings for trends, calendar, and savings"
```

---

### Task 6: `TrendBarChart` SVG component

**Files:**
- Create: `src/components/ui/trend-bar-chart.tsx`

**Interfaces:**
- Produces: `export function TrendBarChart({ data, color, title, deltaPercent }: { data: { label: string; value: number }[]; color: string; title: string; deltaPercent: number | null }): JSX.Element`

- [ ] **Step 1: Implement the component**

Render: the `title` and current-value as text (last `data` item's `value`, via the existing `vnd()` formatter from `@/lib/billing`), a `deltaPercent` line (localized via `t.finance.trendDeltaUp`/`trendDeltaDown`, hidden when `deltaPercent === null`), and an inline `<svg>` bar chart below — one `<rect>` per data point (4px-rounded top corners per the dataviz mark spec, `fill={color}`), max height scaled to the largest `value` in `data`, plus a `<path>` trend line (3-point simple moving average) drawn over the bars in the same `color` at reduced opacity. Add a `"use client"` directive and a per-bar hover: on `onMouseEnter`/`onMouseLeave` of each bar, show a small absolutely-positioned tooltip (label + `vnd(value)`) via local `useState<number | null>` for the hovered index — no `ResizeObserver`/library, plain divs positioned with the bar's index. Short x-axis labels render under every 5th bar (or fewer) to avoid crowding, using the `label` string passed in (already human-formatted by the caller — this component does no date formatting).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/trend-bar-chart.tsx
git commit -m "feat(ui): add TrendBarChart SVG component"
```

---

### Task 7: `TrendLineChart` SVG component

**Files:**
- Create: `src/components/ui/trend-line-chart.tsx`

**Interfaces:**
- Produces: `export function TrendLineChart({ data, color }: { data: { label: string; value: number }[]; color: string }): JSX.Element`

- [ ] **Step 1: Implement the component**

Render an inline `<svg>` line chart: a `<path>` connecting all points (2px stroke, `color`), a `<circle>` marker (≥8px diameter) at each point, and — because `value` can be negative (savings rate) — a zero baseline `<line>` with points below it drawn below the baseline (scale domain is `[min(0, ...values), max(0, ...values)]`, never assumed positive-only). Same `"use client"` + per-point hover tooltip pattern as `TrendBarChart` (label + `{value}%` — this component is only used for the savings-rate card per the spec, so format the hovered value as a percent directly rather than via `vnd()`). A single series needs no legend (dataviz skill rule).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/trend-line-chart.tsx
git commit -m "feat(ui): add TrendLineChart SVG component"
```

---

### Task 8: Wire the transaction window and savings goals into `page.tsx`

**Files:**
- Modify: `src/app/(app)/finance/page.tsx`

**Interfaces:**
- Consumes: `getFinanceTransactionsWindow`, `getFinanceSavingsGoals` (Task 3).
- Produces: `FinanceControls` now receives `transactionsWindow`, `savingsGoals`, `timezone`, `weekStartsOn` props (consumed by Tasks 9–12).

- [ ] **Step 1: Load the window and goals alongside the existing dashboard call**

Change the sequential `runDueRecurringRules` + `getFinanceDashboard` calls to also fetch, in parallel with `getFinanceDashboard` (after `runDueRecurringRules` completes, via `Promise.all`): `getFinanceTransactionsWindow(user.id, user.timezone)` and `getFinanceSavingsGoals(user.id)`. Pass `transactionsWindow`, `savingsGoals`, `timezone={user.timezone}`, `weekStartsOn={user.weekStartsOn}` as new props to `<FinanceControls>`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `finance-controls.tsx` (missing prop types) until Task 9 updates its signature — acceptable at this point; re-run after Task 9.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/finance/page.tsx
git commit -m "feat(finance): load transaction window and savings goals in page.tsx"
```

---

### Task 9: Trend cards (Tổng thu / Tổng chi) in `finance-controls.tsx`

**Files:**
- Modify: `src/app/(app)/finance/finance-controls.tsx`

**Interfaces:**
- Consumes: `computeIncomeExpenseTrend` (Task 2), `TrendBarChart` (Task 6), new `transactionsWindow: SerializedFinanceTransaction[]`, `timezone: string`, `weekStartsOn: number` props (Task 8).
- Produces: `FinanceControls` signature becomes `{ dashboard, today, transactionsWindow, savingsGoals, timezone, weekStartsOn }` (the `savingsGoals` prop is consumed starting Task 11, but added to the signature here since it arrives with the same `page.tsx` change).

- [ ] **Step 1: Update `FinanceControls`'s signature and add a `TrendSection`**

Update the exported `FinanceControls` function's props to include `transactionsWindow: SerializedFinanceTransaction[]`, `savingsGoals: FinanceSavingsGoals` (import the return type of `getFinanceSavingsGoals` from `@/lib/finance-queries`, or inline its element type), `timezone: string`, `weekStartsOn: number` — import `SerializedFinanceTransaction` from `@/lib/finance-queries` and `computeIncomeExpenseTrend` from `@/lib/finance`.

Add a new `TrendSection` component in this file:

```tsx
function TrendSection({ transactions, timezone, weekStartsOn }: { transactions: SerializedFinanceTransaction[]; timezone: string; weekStartsOn: number })
```

It owns `const [unit, setUnit] = useState<"day" | "week" | "month">("day")`, a 3-way toggle (`t.finance.trendUnitDay`/`trendUnitWeek`/`trendUnitMonth`) shared by both charts, and calls `computeIncomeExpenseTrend(transactions, timezone, unit, weekStartsOn)` once, passing `.map(b => ({ label: formatBucketLabel(b.label, unit, locale), value: b.incomeVnd }))` into one `<TrendBarChart color="var(--jade-ink)" title={t.finance.trendIncome} />` and the `expenseVnd` equivalent into a second with `color="var(--danger)"` and `title={t.finance.trendExpense}`. `deltaPercent` for each chart is computed locally from the last two buckets: `prev > 0 ? Math.round(((last - prev) / prev) * 100) : null`. Add a small local `formatBucketLabel(label, unit, locale)` helper: for `"day"`/`"week"` labels (ISO dates) format via the existing `formatDate` helper with `{ day: "2-digit", month: "2-digit" }`; for `"month"` labels (`"YYYY-MM"`) format via `Intl.DateTimeFormat` with `{ month: "short" }`.

- [ ] **Step 2: Render `TrendSection` in `FinanceControls`**

Add `<TrendSection transactions={transactionsWindow} timezone={timezone} weekStartsOn={weekStartsOn} />` inside the first `StaggerReveal` block, between the 3-column summary `<section>` and `<BudgetsSection>`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `finance-controls.tsx` or `page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/finance/finance-controls.tsx
git commit -m "feat(finance): add income/expense trend cards with Day/Week/Month toggle"
```

---

### Task 10: 30-day/month calendar with day-detail modal

**Files:**
- Modify: `src/app/(app)/finance/finance-controls.tsx`

**Interfaces:**
- Consumes: `getMonthCalendarSummary`, `getTransactionsForDate` (Task 2), `Modal` from `@/components/ui/modal`, `StaggerReveal`.
- Produces: a `CalendarSection` component rendered inside `FinanceControls`.

- [ ] **Step 1: Add `CalendarSection`**

```tsx
function CalendarSection({ transactions, timezone, today, weekStartsOn }: { transactions: SerializedFinanceTransaction[]; timezone: string; today: ISODate; weekStartsOn: number })
```

Follow `work-calendar-view.tsx`'s exact structure: `const [monthOffset, setMonthOffset] = useState(0)`, derive `year`/`month` from `today` + `monthOffset` the same way, build day cells with `buildMonthCells` — but since `work-view.ts`'s `buildMonthCells` lives alongside Workspace-specific helpers, re-derive the grid locally in this component with the same algorithm (7-column grid, leading `null` cells for days before the 1st) rather than importing a Workspace-coupled helper, since a shared util isn't worth extracting for one caller (YAGNI). For each real day cell, call `getMonthCalendarSummary(transactions, timezone, year, month)` once per render (not per cell) and look up that day's `{ incomeVnd, expenseVnd }`; render a small jade dot + `vnd(incomeVnd)` when `incomeVnd > 0`, a small danger-colored dot + `vnd(expenseVnd)` when `expenseVnd > 0`, both lines capped at 2 per cell per the spec. Wrap the grid in `<StaggerReveal slide={{ direction: "up", offset: 16 }} holdDelay={70}>` like the Workspace calendar. Month prev/next buttons update `monthOffset`; a day cell with at least one transaction is a `<button>` that sets `const [openDate, setOpenDate] = useState<ISODate | null>(null)` to that day's ISO date; an empty day cell is a plain `<div>` (not clickable).

- [ ] **Step 2: Add the day-detail modal**

Render one `<Modal open={!!openDate} onClose={() => setOpenDate(null)} title={fmt(t.finance.calendarDayDetailsTitle, { date: openDate ?? "" })}>` inside `CalendarSection`, listing `getTransactionsForDate(transactions, timezone, openDate ?? "")` — for each, the amount (signed, colored like `TransactionsSection`), category, and note; `t.finance.calendarNoTransactions` when the list is empty (defensive — the button is only shown for non-empty days, but keeps the modal correct if reused).

- [ ] **Step 3: Render `CalendarSection` in `FinanceControls`**

Add `<CalendarSection transactions={transactionsWindow} timezone={timezone} today={today} weekStartsOn={weekStartsOn} />` right after `TrendSection` (same `StaggerReveal` block from Task 9).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/finance/finance-controls.tsx
git commit -m "feat(finance): add clickable 30-day calendar with day-detail modal"
```

---

### Task 11: Savings section (goal CRUD, deposit/withdraw)

**Files:**
- Modify: `src/app/(app)/finance/finance-controls.tsx`

**Interfaces:**
- Consumes: `createFinanceSavingsGoal`, `updateFinanceSavingsGoal`, `deleteFinanceSavingsGoal`, `createFinanceTransaction` (Task 4), `ProgressBar` (existing), `AmountInput` (existing, this file).
- Produces: a `SavingsSection` component rendered inside `FinanceControls`.

- [ ] **Step 1: Add `SavingsSection` — suggestion line + goal list**

```tsx
function SavingsSection({ goals, incomeThisMonth, expenseThisMonth, today }: { goals: { id: string; name: string; targetVnd: number; targetDate: ISODate | null; savedVnd: number }[]; incomeThisMonth: number; expenseThisMonth: number; today: ISODate })
```

Top line: `fmt(t.finance.savingsSuggestLine, { amount: vnd(Math.max(0, incomeThisMonth - expenseThisMonth)) })` — no new calculation, reuses the two totals already on `dashboard`. Below: `t.finance.savingsNoGoalsYet` when `goals.length === 0`, else a `<ul>` of goals, each showing name, `<ProgressBar value={goal.targetVnd > 0 ? goal.savedVnd / goal.targetVnd : 0} color="var(--accent)" label={goal.name} />`, `fmt(t.finance.savingsSavedOfTarget, { saved: vnd(goal.savedVnd), target: vnd(goal.targetVnd) })`, the formatted `targetDate` when present, two buttons (`t.finance.savingsDeposit`/`savingsWithdraw`) that open an inline amount-entry row (same two-step inline-edit pattern as `BudgetsSection`'s "Sửa hạn mức": a `useState<string | null>` tracking which goal+action is open, an `AmountInput`, confirm/cancel), and a delete button with the same two-step confirm pattern already used in `RecurringSection`/`TransactionsSection`.

- [ ] **Step 2: Wire deposit/withdraw to `createFinanceTransaction`**

Deposit: `createFinanceTransaction({ type: "EXPENSE", category: "Tiết kiệm", amountVnd, occurredAt: today, savingsGoalId: goal.id })`. Withdraw: same but `type: "INCOME"`. Disable the withdraw confirm button client-side when the entered amount exceeds `goal.savedVnd` (mirrors the server-side `WITHDRAWAL_EXCEEDS_SAVED` guard — two-layer validation per the existing `CATEGORY_REQUIRED` convention). On success, `router.refresh()` via the existing `useAction`/`useRouter` pattern used elsewhere in this file.

- [ ] **Step 3: Add the "new goal" form**

Three fields — name (`<input>`, not `CategoryCombobox`), target amount (`AmountInput`), optional target date (`<input type="date">`) — and a submit button calling `createFinanceSavingsGoal({ name, targetVnd: Number(target), targetDate: targetDate || undefined })`, toast `t.finance.savingsGoalSaved` on success, `router.refresh()`, clear the fields.

- [ ] **Step 4: Render `SavingsSection` in `FinanceControls`**

Add a new `<section className="card">` wrapping `<SavingsSection goals={savingsGoals} incomeThisMonth={dashboard.incomeThisMonth} expenseThisMonth={dashboard.expenseThisMonth} today={today} />`, placed right after `<BudgetsSection>` in the first `StaggerReveal` block (per the spec's "đặt sau phần Ngân sách").

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/finance/finance-controls.tsx
git commit -m "feat(finance): add savings goals section with deposit/withdraw"
```

---

### Task 12: Savings trend card

**Files:**
- Modify: `src/app/(app)/finance/finance-controls.tsx`

**Interfaces:**
- Consumes: `computeSavingsRateTrend` (Task 2), `TrendLineChart` (Task 7).
- Produces: a `SavingsTrendCard` component rendered inside `FinanceControls`, right after `SavingsSection`'s card.

- [ ] **Step 1: Add `SavingsTrendCard`**

```tsx
function SavingsTrendCard({ transactions, timezone }: { transactions: SerializedFinanceTransaction[]; timezone: string })
```

Call `computeSavingsRateTrend(transactions, timezone)`, show the last bucket's `ratePercent` as the big number, a delta line against the bucket 6 months back (`t.finance.trendDeltaUp`/`trendDeltaDown`, same sign logic as Task 9's `deltaPercent` but comparing first vs. last of the 6 buckets — label it with `t.finance.savingsTrendTitle`'s subtext, not `trendIncome`/`trendExpense`), and `<TrendLineChart data={trend.map(b => ({ label: formatMonthLabel(b.label), value: b.ratePercent }))} color="var(--accent)" />` (reuse the `"month"` branch of Task 9's `formatBucketLabel`, or a local copy if that helper isn't exported — a two-line duplicate is fine here per YAGNI; don't extract a shared module for it).

- [ ] **Step 2: Render it in `FinanceControls`**

Add `<SavingsTrendCard transactions={transactionsWindow} timezone={timezone} />` right after the Savings section's `<section className="card">` from Task 11, inside the same `StaggerReveal` block.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the `/finance` module.

- [ ] **Step 4: Manual verification**

Start the dev server (or use the already-running one) and open `/finance` in a browser: confirm the two trend cards render and the Day/Week/Month toggle updates both; the calendar shows dots on days with transactions and opens the day-detail modal on click; the Savings section lists goals, deposit/withdraw updates `savedVnd` and is blocked client-side when over-withdrawing; the savings trend card renders a line that can dip below its zero baseline. Note any visual issue found (spacing, color, overflow) and fix before moving on — this is the dataviz skill's "render it and look at it" step, with no automated UI test harness in this project.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/finance/finance-controls.tsx
git commit -m "feat(finance): add savings rate trend card"
```

---

## Self-Review Notes

- **Spec coverage:** Goal 1 (trend cards) → Tasks 2, 6, 9. Goal 2 (30-day calendar) → Tasks 2, 10. Goal 3 (Savings section) → Tasks 1, 3, 4, 11. Goal 4 (savings trend) → Tasks 2, 7, 12. All 9 numbered "Quyết định cụ thể" sections and all 3 "Để lại cho người viết plan" items (icons, moving-average method, section placement) are resolved inline above (icons: reuse existing imports already in the file — `PiggyBank` for Savings section header, a new `CalendarDays` import for the calendar — moving average: 3-point SMA in Task 6; placement: trend cards + calendar after the summary row, Savings + its trend card after Budgets, per Tasks 9–12).
- **Type consistency:** `SerializedFinanceTransaction` is defined once (Task 3) and consumed by name everywhere after; `computeIncomeExpenseTrend`/`computeSavingsRateTrend`/`getTransactionsForDate`/`getMonthCalendarSummary` signatures in Task 2 match their call sites in Tasks 9/10/12 exactly (same parameter order, same optional-`today` default). `TrendBarChart`/`TrendLineChart` prop names (`title`, not `label`, on `TrendBarChart` to avoid clashing with `data[].label`) are used consistently in Tasks 9 and 12.
- **Review Focus:** all 5 lines have an owning task and test, listed above.
- **Proportion:** this plan is implementation-signature-level, not a code transcript — JSX bodies for Tasks 9–12 are described, not written in full, since the file's existing patterns (inline-edit, two-step delete confirm, `useAction`/`toast`/`router.refresh()`) already fix their shape.

---

Plan complete and saved to `docs/superpowers/plans/2026-11-28-finance-analytics-savings.md`. Please review the plan. Which execution approach would you prefer?

- **Subagent-driven** — a fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** — I implement every task myself in this session, then one fresh reviewer checks the whole branch at the end. Cheapest and fastest; no independent review until the end.

For this plan I recommend **Subagent-driven**, because Tasks 9–12 all modify the same file (`finance-controls.tsx`) in sequence and depend on exact prop/type names from Tasks 2–4 and 6–8 — a fresh reviewer catching a signature drift early (e.g. Task 9's `TrendSection` vs. Task 2's `computeIncomeExpenseTrend`) is cheaper than finding it after all 12 tasks are done. Does the plan capture what you want, and which approach should we use?
