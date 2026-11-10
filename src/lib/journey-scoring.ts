import { addDays, daysBetween, isoInZone } from "@/lib/dates";

export type WorkspaceScoreCode =
  | "WORK_COMPLETED_EARLY"
  | "WORK_COMPLETED_ON_TIME"
  | "IMPORTANT_WORK_BONUS"
  | "WORK_ASSIGNED_AND_COMPLETED_SAME_DAY"
  | "WORK_OVERDUE_FIRST_DAY"
  | "WORK_OVERDUE_ADDITIONAL_DAY";

export type ScoreEntry = {
  code: WorkspaceScoreCode;
  points: number;
  localDate: string;
};

export type WorkspaceScoreRules = {
  earlyCompletionPoints: number;
  onTimeCompletionPoints: number;
  importantWorkBonus: number;
  assignedAndCompletedSameDayBonus: number;
  overdueFirstDayPenalty: number;
  overdueAdditionalDayPenalty: number;
  maxOverduePenalty: number | null;
};

export const DEFAULT_WORKSPACE_SCORE_RULES: WorkspaceScoreRules = {
  earlyCompletionPoints: 15,
  onTimeCompletionPoints: 10,
  importantWorkBonus: 5,
  assignedAndCompletedSameDayBonus: 5,
  overdueFirstDayPenalty: 5,
  overdueAdditionalDayPenalty: 2,
  maxOverduePenalty: null,
};

export const DEFAULT_DAILY_SCORE_WEIGHTS = {
  missions: 60,
  habits: 20,
  workspace: 20,
} as const;

export type WorkspaceCompletionSnapshot = {
  dueAt: Date | null;
  completedAt: Date;
  assignedAt: Date | null;
  important: boolean;
  timezone: string;
};

export function isScorableCompletionTransition(input: {
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  completedAt?: Date | null;
}) {
  return input.eventType !== "CARD_CREATED" &&
    input.fromStatus !== "listDone" &&
    input.toStatus === "listDone" &&
    input.completedAt instanceof Date &&
    Number.isFinite(input.completedAt.getTime());
}

export function scoreWorkspaceCompletion(
  snapshot: WorkspaceCompletionSnapshot,
  rules: WorkspaceScoreRules = DEFAULT_WORKSPACE_SCORE_RULES,
): ScoreEntry[] {
  const completedAtMs = snapshot.completedAt.getTime();
  if (!Number.isFinite(completedAtMs)) return [];

  const localDate = isoInZone(snapshot.completedAt, snapshot.timezone);
  const entries: ScoreEntry[] = [];

  if (snapshot.dueAt) {
    const dueAtMs = snapshot.dueAt.getTime();
    if (Number.isFinite(dueAtMs) && completedAtMs < dueAtMs) {
      entries.push({ code: "WORK_COMPLETED_EARLY", points: rules.earlyCompletionPoints, localDate });
    } else if (Number.isFinite(dueAtMs) && completedAtMs === dueAtMs) {
      entries.push({ code: "WORK_COMPLETED_ON_TIME", points: rules.onTimeCompletionPoints, localDate });
    }
  }

  if (snapshot.important && rules.importantWorkBonus > 0) {
    entries.push({ code: "IMPORTANT_WORK_BONUS", points: rules.importantWorkBonus, localDate });
  }

  if (
    snapshot.assignedAt &&
    Number.isFinite(snapshot.assignedAt.getTime()) &&
    isoInZone(snapshot.assignedAt, snapshot.timezone) === localDate &&
    rules.assignedAndCompletedSameDayBonus > 0
  ) {
    entries.push({
      code: "WORK_ASSIGNED_AND_COMPLETED_SAME_DAY",
      points: rules.assignedAndCompletedSameDayBonus,
      localDate,
    });
  }

  return entries;
}

export function scoreOverdueDays(
  input: { dueAt: Date | null; throughAt: Date; timezone: string },
  rules: WorkspaceScoreRules = DEFAULT_WORKSPACE_SCORE_RULES,
): ScoreEntry[] {
  if (!input.dueAt || !Number.isFinite(input.dueAt.getTime()) || !Number.isFinite(input.throughAt.getTime())) return [];
  if (input.throughAt.getTime() <= input.dueAt.getTime()) return [];

  const firstDay = isoInZone(input.dueAt, input.timezone);
  const lastDay = isoInZone(input.throughAt, input.timezone);
  const entries: ScoreEntry[] = [];
  let totalPenalty = 0;

  for (let dayOffset = 0; dayOffset <= daysBetween(firstDay, lastDay); dayOffset++) {
    const localDate = addDays(firstDay, dayOffset);
    const code = dayOffset === 0 ? "WORK_OVERDUE_FIRST_DAY" : "WORK_OVERDUE_ADDITIONAL_DAY";
    const configuredPenalty = dayOffset === 0 ? rules.overdueFirstDayPenalty : rules.overdueAdditionalDayPenalty;
    const remainingCap = rules.maxOverduePenalty == null ? Number.POSITIVE_INFINITY : Math.max(0, rules.maxOverduePenalty - totalPenalty);
    const penalty = Math.min(Math.max(0, configuredPenalty), remainingCap);
    if (penalty <= 0) break;

    entries.push({ code, points: -penalty, localDate });
    totalPenalty += penalty;
  }

  return entries;
}

export type DailyScoreInput = {
  missionsDone: number;
  missionsDue: number;
  habitsDone: number;
  habitsDue: number;
  workspaceOnTime: number;
  workspaceDue: number;
  weights?: { missions: number; habits: number; workspace: number };
};

export function calculateJourneyDailyScore(input: DailyScoreInput): number {
  const weights = input.weights ?? DEFAULT_DAILY_SCORE_WEIGHTS;
  const components = [
    { done: input.missionsDone, due: input.missionsDue, weight: weights.missions },
    { done: input.habitsDone, due: input.habitsDue, weight: weights.habits },
    { done: input.workspaceOnTime, due: input.workspaceDue, weight: weights.workspace },
  ].filter((part) => part.due > 0 && Number.isFinite(part.weight) && part.weight > 0);

  const totalWeight = components.reduce((sum, part) => sum + part.weight, 0);
  if (!totalWeight) return 0;

  const weightedRate = components.reduce((sum, part) => {
    const rate = Math.max(0, Math.min(1, part.done / part.due));
    return sum + rate * part.weight;
  }, 0);

  return Math.round((weightedRate / totalWeight) * 100);
}

export function workspaceScoreIdempotencyKey(cardId: string, code: WorkspaceScoreCode, localDate: string) {
  if (code === "WORK_COMPLETED_EARLY" || code === "WORK_COMPLETED_ON_TIME") return `workcard:${cardId}:completion-reward`;
  if (code === "IMPORTANT_WORK_BONUS") return `workcard:${cardId}:important-bonus`;
  if (code === "WORK_ASSIGNED_AND_COMPLETED_SAME_DAY") return `workcard:${cardId}:same-day-bonus`;
  return `workcard:${cardId}:${code}:${localDate}`;
}