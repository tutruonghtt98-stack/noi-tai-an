import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateJourneyDailyScore,
  DEFAULT_DAILY_SCORE_WEIGHTS,
  DEFAULT_WORKSPACE_SCORE_RULES,
  isScorableCompletionTransition,
  scoreOverdueDays,
  scoreWorkspaceCompletion,
  workspaceScoreIdempotencyKey,
} from "./journey-scoring";

const vn = "Asia/Ho_Chi_Minh";

test("scores early and exact-deadline completion using timestamps", () => {
  const early = scoreWorkspaceCompletion({
    dueAt: new Date("2026-11-05T10:00:00Z"),
    completedAt: new Date("2026-11-05T09:59:59Z"),
    assignedAt: null,
    important: false,
    timezone: vn,
  });
  const onTime = scoreWorkspaceCompletion({
    dueAt: new Date("2026-11-05T10:00:00Z"),
    completedAt: new Date("2026-11-05T10:00:00Z"),
    assignedAt: null,
    important: false,
    timezone: vn,
  });

  assert.deepEqual(early.map((entry) => entry.points), [15]);
  assert.deepEqual(onTime.map((entry) => entry.points), [10]);
});

test("late completion gets no on-time reward and does not erase overdue penalties", () => {
  const completedAt = new Date("2026-11-06T09:00:00Z");
  const rewards = scoreWorkspaceCompletion({
    dueAt: new Date("2026-11-05T10:00:00Z"),
    completedAt,
    assignedAt: null,
    important: false,
    timezone: vn,
  });
  const penalties = scoreOverdueDays({
    dueAt: new Date("2026-11-05T10:00:00Z"),
    throughAt: completedAt,
    timezone: vn,
  });

  assert.deepEqual(rewards, []);
  assert.deepEqual(penalties.map((entry) => entry.points), [-5, -2]);
});

test("adds important and same-local-day bonuses without a deadline", () => {
  const entries = scoreWorkspaceCompletion({
    dueAt: null,
    assignedAt: new Date("2026-11-04T17:30:00Z"),
    completedAt: new Date("2026-11-05T16:30:00Z"),
    important: true,
    timezone: vn,
  });

  assert.deepEqual(entries.map((entry) => entry.points), [5, 5]);
  assert.equal(entries[0]?.localDate, "2026-11-05");
});

test("does not award same-day bonus across a local midnight", () => {
  const entries = scoreWorkspaceCompletion({
    dueAt: null,
    assignedAt: new Date("2026-11-05T16:30:00Z"),
    completedAt: new Date("2026-11-05T17:30:00Z"),
    important: false,
    timezone: vn,
  });

  assert.deepEqual(entries, []);
});

test("overdue penalties are dated in the user's timezone and stop at completion", () => {
  const entries = scoreOverdueDays({
    dueAt: new Date("2026-11-04T16:00:00Z"),
    throughAt: new Date("2026-11-06T17:00:00Z"),
    timezone: vn,
  });

  assert.deepEqual(entries.map((entry) => [entry.localDate, entry.points]), [
    ["2026-11-04", -5],
    ["2026-11-05", -2],
    ["2026-11-06", -2],
    ["2026-11-07", -2],
  ]);
});

test("does not penalize before due time and honors an optional penalty cap", () => {
  const dueAt = new Date("2026-11-05T10:00:00Z");
  assert.deepEqual(
    scoreOverdueDays({ dueAt, throughAt: new Date("2026-11-05T09:59:59Z"), timezone: vn }),
    [],
  );

  const capped = scoreOverdueDays(
    { dueAt, throughAt: new Date("2026-11-09T10:00:00Z"), timezone: vn },
    { ...DEFAULT_WORKSPACE_SCORE_RULES, maxOverduePenalty: 6 },
  );
  assert.deepEqual(capped.map((entry) => entry.points), [-5, -1]);
});

test("computes a weighted daily score and redistributes unused components", () => {
  assert.equal(
    calculateJourneyDailyScore({
      missionsDone: 3,
      missionsDue: 3,
      habitsDone: 1,
      habitsDue: 2,
      workspaceOnTime: 0,
      workspaceDue: 0,
    }),
    88,
  );
  assert.equal(
    calculateJourneyDailyScore({
      missionsDone: 1,
      missionsDue: 2,
      habitsDone: 0,
      habitsDue: 0,
      workspaceOnTime: 0,
      workspaceDue: 0,
      weights: DEFAULT_DAILY_SCORE_WEIGHTS,
    }),
    50,
  );
});

test("does not award completion points for creation in Done or reopening a card", () => {
  const completedAt = new Date("2026-11-05T10:00:00Z");
  assert.equal(isScorableCompletionTransition({ eventType: "CARD_CREATED", fromStatus: null, toStatus: "listDone", completedAt }), false);
  assert.equal(isScorableCompletionTransition({ eventType: "CARD_REOPENED", fromStatus: "listDone", toStatus: "listToDo", completedAt: null }), false);
  assert.equal(isScorableCompletionTransition({ eventType: "CARD_COMPLETED", fromStatus: "listReview", toStatus: "listDone", completedAt }), true);
});

test("uses a card-wide completion reward key and per-day overdue keys", () => {
  assert.equal(
    workspaceScoreIdempotencyKey("card-1", "WORK_COMPLETED_EARLY", "2026-11-05"),
    workspaceScoreIdempotencyKey("card-1", "WORK_COMPLETED_ON_TIME", "2026-11-06"),
  );
  assert.notEqual(
    workspaceScoreIdempotencyKey("card-1", "WORK_OVERDUE_ADDITIONAL_DAY", "2026-11-05"),
    workspaceScoreIdempotencyKey("card-1", "WORK_OVERDUE_ADDITIONAL_DAY", "2026-11-06"),
  );
});