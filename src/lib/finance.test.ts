import test from "node:test";
import assert from "node:assert/strict";
import {
  budgetWarningLevel,
  computeIncomeExpenseTrend,
  computeSavingsRateTrend,
  getMonthCalendarSummary,
  getTransactionsForDate,
  nextRunDateFor,
} from "./finance";

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

test("getTransactionsForDate returns only same-day transactions, [] when none", () => {
  const txs = [
    { occurredAt: "2026-11-28", id: "a" },
    { occurredAt: "2026-11-27", id: "b" },
  ] as unknown as { occurredAt: string; id: string }[];
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
