import assert from "node:assert/strict";
import test from "node:test";
import { getJourneyCalendarTransition, getJourneyLevelGate } from "./journey-calendar";

test("advances once after a completed day and marks later gaps as missed", () => {
  const result = getJourneyCalendarTransition({
    today: "2026-11-05",
    currentDay: 1,
    lastRecord: { date: "2026-11-02", journeyDay: 1, status: "COMPLETED" },
  });

  assert.equal(result.currentDay, 2);
  assert.deepEqual(result.missedDates, [
    { date: "2026-11-03", journeyDay: 2 },
    { date: "2026-11-04", journeyDay: 2 },
  ]);
});

test("does not advance the curriculum day after missed or incomplete days", () => {
  const result = getJourneyCalendarTransition({
    today: "2026-11-04",
    currentDay: 7,
    lastRecord: { date: "2026-11-03", journeyDay: 7, status: "IN_PROGRESS" },
  });

  assert.equal(result.currentDay, 7);
  assert.deepEqual(result.missedDates, [{ date: "2026-11-03", journeyDay: 7 }]);
});

test("a rest day advances without a missed-day penalty", () => {
  const result = getJourneyCalendarTransition({
    today: "2026-11-05",
    currentDay: 12,
    lastRecord: { date: "2026-11-04", journeyDay: 12, status: "REST" },
  });

  assert.equal(result.currentDay, 13);
  assert.deepEqual(result.missedDates, []);
});

test("does not advance again on the same calendar day", () => {
  const result = getJourneyCalendarTransition({
    today: "2026-11-05",
    currentDay: 4,
    lastRecord: { date: "2026-11-05", journeyDay: 3, status: "COMPLETED" },
  });

  assert.equal(result.currentDay, 4);
  assert.deepEqual(result.missedDates, []);
});

test("marks the journey complete after day 180 is completed", () => {
  const result = getJourneyCalendarTransition({
    today: "2026-11-06",
    currentDay: 180,
    lastRecord: { date: "2026-11-05", journeyDay: 180, status: "COMPLETED" },
  });

  assert.equal(result.currentDay, 181);
  assert.equal(result.journeyCompleted, true);
});

test("requires all configured criteria before advancing a level", () => {
  const gate = getJourneyLevelGate({
    completedMissions: 68,
    totalMissions: 90,
    thresholdPercent: 75,
    monthlyChallengeCompleted: true,
    reviewPassed: true,
  });

  assert.equal(gate.completionRate, 76);
  assert.equal(gate.canAdvance, true);
});

test("keeps the level available for recovery when any criterion is missing", () => {
  const gate = getJourneyLevelGate({
    completedMissions: 60,
    totalMissions: 90,
    thresholdPercent: 75,
    monthlyChallengeCompleted: false,
    reviewPassed: true,
  });

  assert.equal(gate.completionRate, 67);
  assert.equal(gate.canAdvance, false);
});