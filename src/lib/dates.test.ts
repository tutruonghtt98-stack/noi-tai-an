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
