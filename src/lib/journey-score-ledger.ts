import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isoInZone } from "@/lib/dates";
import {
  DEFAULT_WORKSPACE_SCORE_RULES,
  isScorableCompletionTransition,
  legacyWorkspaceScoreIdempotencyKey,
  scoreOverdueDays,
  scoreWorkspaceCompletion,
  workspaceScoreIdempotencyKey,
  type WorkspaceScoreCode,
  type WorkspaceScoreRules,
} from "@/lib/journey-scoring";

type Transaction = Prisma.TransactionClient;

type WorkCardScoreEventInput = {
  cardId: string;
  title: string;
  label: string | null;
  actorUserId: string;
  eventType: string;
  fromDueAt: Date | null;
  toDueAt: Date | null;
  /** userIds (matched accounts only) assigned before this event. */
  fromAssigneeIds: string[];
  /** userIds (matched accounts only) assigned after this event. Each one is scored independently. */
  toAssigneeIds: string[];
  fromTeamId: string | null;
  toTeamId: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: Date;
  occurredAt: Date;
  completedAt?: Date | null;
};

const ASSIGNMENT_EVENT_TYPES = ["CARD_CREATED", "ASSIGNEE_CHANGED"];

type RuleSetFields = WorkspaceScoreRules & { importantLabel: string };

function workspaceRules(ruleSet: RuleSetFields): WorkspaceScoreRules {
  return {
    earlyCompletionPoints: ruleSet.earlyCompletionPoints,
    onTimeCompletionPoints: ruleSet.onTimeCompletionPoints,
    importantWorkBonus: ruleSet.importantWorkBonus,
    assignedAndCompletedSameDayBonus: ruleSet.assignedAndCompletedSameDayBonus,
    overdueFirstDayPenalty: ruleSet.overdueFirstDayPenalty,
    overdueAdditionalDayPenalty: ruleSet.overdueAdditionalDayPenalty,
    maxOverduePenalty: ruleSet.maxOverduePenalty,
  };
}

/**
 * Rows written before per-person keys existed carry the legacy (userId-less) key.
 * Drop any new row whose legacy key already exists for that same user, so the
 * key-format switch never scores one person twice for the same card/event/day
 * (spec anti-goal: existing single-assignee cards must not be double-scored).
 */
async function withoutLegacyDuplicates<T extends { userId: string; legacyKey: string }>(
  client: Pick<Transaction, "disciplineTransaction">,
  rows: T[],
): Promise<T[]> {
  if (!rows.length) return rows;
  const existing = await client.disciplineTransaction.findMany({
    where: { idempotencyKey: { in: [...new Set(rows.map((row) => row.legacyKey))] } },
    select: { userId: true, idempotencyKey: true },
  });
  if (!existing.length) return rows;
  const taken = new Set(existing.map((row) => `${row.userId}\u0000${row.idempotencyKey}`));
  return rows.filter((row) => !taken.has(`${row.userId}\u0000${row.legacyKey}`));
}

async function createDisciplineEntries(
  tx: Transaction,
  input: {
    userId: string;
    journeyId: string;
    workCardEventId?: string | null;
    cardId: string;
    title: string;
    dueAt: Date | null;
    completedAt?: Date | null;
    status: string | null;
    points: number;
    eventType: WorkspaceScoreCode;
    reason: string;
    localDate: string;
  }[],
) {
  const fresh = await withoutLegacyDuplicates(tx, input.map((entry) => ({
    ...entry,
    legacyKey: legacyWorkspaceScoreIdempotencyKey(entry.cardId, entry.eventType, entry.localDate),
  })));
  if (!fresh.length) return;
  await tx.disciplineTransaction.createMany({
    data: fresh.map((entry) => ({
      userId: entry.userId,
      journeyId: entry.journeyId,
      workCardEventId: entry.workCardEventId ?? null,
      workCardIdSnapshot: entry.cardId,
      sourceType: "WORK_CARD",
      sourceId: entry.cardId,
      eventType: entry.eventType,
      points: entry.points,
      reason: entry.reason,
      idempotencyKey: workspaceScoreIdempotencyKey(entry.cardId, entry.eventType, entry.localDate, entry.userId),
      dueAtSnapshot: entry.dueAt,
      completedAtSnapshot: entry.completedAt ?? null,
      statusSnapshot: entry.status,
      assigneeUserIdSnapshot: entry.userId,
      occurredAt: entry.completedAt ?? new Date(`${entry.localDate}T12:00:00.000Z`),
    })),
    skipDuplicates: true,
  });
}

export async function recordWorkCardScoreEvent(tx: Transaction, input: WorkCardScoreEventInput) {
  const event = await tx.workCardEvent.create({
    data: {
      workCardId: input.cardId,
      workCardIdSnapshot: input.cardId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      idempotencyKey: `card-event:${randomUUID()}`,
      titleSnapshot: input.title,
      fromDueAt: input.fromDueAt,
      toDueAt: input.toDueAt,
      fromAssigneeIds: input.fromAssigneeIds,
      toAssigneeIds: input.toAssigneeIds,
      fromTeamId: input.fromTeamId,
      toTeamId: input.toTeamId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      occurredAt: input.occurredAt,
    },
  });

  const completedNow = isScorableCompletionTransition(input);
  if (!completedNow) return event;
  if (input.toAssigneeIds.length === 0) return event;

  // Every co-assignee is scored in full, independently: one person lacking an
  // active journey only skips that person.
  for (const userId of new Set(input.toAssigneeIds)) {
    await scoreCompletionForUser(tx, input, event, userId);
  }

  return event;
}

/**
 * When did `userId` get onto this card? The latest earlier assignment event that
 * ADDED them (in its `toAssigneeIds` but not its `fromAssigneeIds`). If they were
 * added by this very event, or no earlier event records them (incl. all history
 * from before multi-assignee — deliberately not backfilled), they count as
 * "assigned right now": the current event's `occurredAt`, never `card.createdAt`.
 */
async function findAssignedAt(
  tx: Transaction,
  input: WorkCardScoreEventInput,
  event: { id: string; occurredAt: Date },
  userId: string,
) {
  if (!input.fromAssigneeIds.includes(userId)) return event.occurredAt;
  const assignmentEvent = await tx.workCardEvent.findFirst({
    where: {
      workCardIdSnapshot: input.cardId,
      eventType: { in: ASSIGNMENT_EVENT_TYPES },
      id: { not: event.id },
      occurredAt: { lte: event.occurredAt },
      toAssigneeIds: { array_contains: [userId] },
      NOT: { fromAssigneeIds: { array_contains: [userId] } },
    },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });
  return assignmentEvent?.occurredAt ?? event.occurredAt;
}

async function scoreCompletionForUser(
  tx: Transaction,
  input: WorkCardScoreEventInput,
  event: { id: string; occurredAt: Date },
  userId: string,
) {
  const completedAt = input.completedAt!;
  const journey = await tx.userJourney.findFirst({
    where: { userId, status: "ACTIVE", joinedAt: { lte: completedAt } },
    orderBy: { joinedAt: "desc" },
    include: { ruleSet: true },
  });
  if (!journey) return;

  const assignedAt = await findAssignedAt(tx, input, event, userId);
  // This person's own timezone and rule set — co-assignees may differ.
  const timezone = journey.timezone;
  const important = !!input.label && input.label.trim().toLocaleUpperCase() === journey.ruleSet.importantLabel.trim().toLocaleUpperCase();
  const rules = workspaceRules(journey.ruleSet);
  const completionEntries = scoreWorkspaceCompletion({
    dueAt: input.toDueAt,
    completedAt,
    assignedAt,
    important,
    timezone,
  }, rules);
  const localDate = isoInZone(completedAt, timezone);

  await createDisciplineEntries(tx, completionEntries.map((score) => ({
    userId,
    journeyId: journey.id,
    workCardEventId: event.id,
    cardId: input.cardId,
    title: input.title,
    dueAt: input.toDueAt,
    completedAt: input.completedAt,
    status: input.toStatus,
    points: score.points,
    eventType: score.code,
    reason: input.title,
    localDate,
  })));

  if (input.toDueAt && completedAt > input.toDueAt) {
    const effectivePenaltyStart = [input.toDueAt, assignedAt, journey.joinedAt].reduce((latest, date) => date > latest ? date : latest);
    const overdueEntries = scoreOverdueDays({ dueAt: effectivePenaltyStart, throughAt: completedAt, timezone }, rules);
    await createDisciplineEntries(tx, overdueEntries.map((score) => ({
      userId,
      journeyId: journey.id,
      workCardEventId: event.id,
      cardId: input.cardId,
      title: input.title,
      dueAt: input.toDueAt,
      completedAt: input.completedAt,
      status: input.toStatus,
      points: score.points,
      eventType: score.code,
      reason: input.title,
      localDate: score.localDate,
    })));
  }
}

export async function syncOverdueDiscipline(userId: string, throughAt = new Date()) {
  const journey = await db.userJourney.findFirst({
    where: { userId, status: "ACTIVE", joinedAt: { lte: throughAt } },
    orderBy: { joinedAt: "desc" },
    include: { ruleSet: true },
  });
  if (!journey) return 0;

  const cards = await db.workCard.findMany({
    where: {
      assignees: { some: { userId } },
      dueDate: { lt: throughAt },
      list: { name: { not: "listDone" } },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      createdAt: true,
      list: { select: { name: true } },
    },
  });
  if (!cards.length) return 0;

  // Latest event that added this user to each card (see findAssignedAt).
  const assignmentEvents = await db.workCardEvent.findMany({
    where: {
      workCardIdSnapshot: { in: cards.map((card) => card.id) },
      eventType: { in: ASSIGNMENT_EVENT_TYPES },
      toAssigneeIds: { array_contains: [userId] },
      NOT: { fromAssigneeIds: { array_contains: [userId] } },
    },
    orderBy: { occurredAt: "desc" },
    select: { workCardIdSnapshot: true, occurredAt: true },
  });
  const assignedAt = new Map<string, Date>();
  for (const event of assignmentEvents) if (!assignedAt.has(event.workCardIdSnapshot)) assignedAt.set(event.workCardIdSnapshot, event.occurredAt);

  const rules = workspaceRules(journey.ruleSet);
  const entries = cards.flatMap((card) => {
    if (!card.dueDate) return [];
    // No "current event" here, so the "assigned right now" rule does not apply:
    // with no recorded assignment, keep penalising from the card's own dates
    // (otherwise pre-migration overdue cards would silently stop accruing).
    const startAt = assignedAt.get(card.id) ?? card.createdAt;
    const effectiveDueAt = startAt > card.dueDate ? startAt : card.dueDate;
    const journeyStart = effectiveDueAt > journey.joinedAt ? effectiveDueAt : journey.joinedAt;
    return scoreOverdueDays({ dueAt: journeyStart, throughAt, timezone: journey.timezone }, rules).map((score) => ({
      userId,
      journeyId: journey.id,
      workCardIdSnapshot: card.id,
      sourceType: "WORK_CARD",
      sourceId: card.id,
      eventType: score.code,
      points: score.points,
      reason: card.title,
      idempotencyKey: workspaceScoreIdempotencyKey(card.id, score.code, score.localDate, userId),
      legacyKey: legacyWorkspaceScoreIdempotencyKey(card.id, score.code, score.localDate),
      dueAtSnapshot: card.dueDate,
      statusSnapshot: card.list.name,
      assigneeUserIdSnapshot: userId,
      occurredAt: new Date(`${score.localDate}T12:00:00.000Z`),
    }));
  });

  const fresh = await withoutLegacyDuplicates(db, entries);
  if (!fresh.length) return 0;
  const result = await db.disciplineTransaction.createMany({
    data: fresh.map(({ legacyKey: _legacyKey, ...entry }) => entry),
    skipDuplicates: true,
  });
  return result.count;
}

export const DEFAULT_LEDGER_RULES = DEFAULT_WORKSPACE_SCORE_RULES;