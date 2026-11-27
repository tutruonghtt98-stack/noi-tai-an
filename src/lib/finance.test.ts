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
