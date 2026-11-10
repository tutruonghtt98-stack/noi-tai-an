import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isoInZone } from "@/lib/dates";
import {
  DEFAULT_WORKSPACE_SCORE_RULES,
  isScorableCompletionTransition,
  scoreOverdueDays,
  scoreWorkspaceCompletion,
  workspaceScoreIdempotencyKey,
  type WorkspaceScoreCode,
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
  fromAssigneeUserId: string | null;
  toAssigneeUserId: string | null;
  fromTeamId: string | null;
  toTeamId: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  createdAt: Date;
  occurredAt: Date;
  completedAt?: Date | null;
};

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
  if (!input.length) return;
  await tx.disciplineTransaction.createMany({
    data: input.map((entry) => ({
      userId: entry.userId,
      journeyId: entry.journeyId,
      workCardEventId: entry.workCardEventId ?? null,
      workCardIdSnapshot: entry.cardId,
      sourceType: "WORK_CARD",
      sourceId: entry.cardId,
      eventType: entry.eventType,
      points: entry.points,
      reason: entry.reason,
      idempotencyKey: workspaceScoreIdempotencyKey(entry.cardId, entry.eventType, entry.localDate),
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
      fromAssigneeUserId: input.fromAssigneeUserId,
      toAssigneeUserId: input.toAssigneeUserId,
      fromTeamId: input.fromTeamId,
      toTeamId: input.toTeamId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      occurredAt: input.occurredAt,
    },
  });

  const completedNow = isScorableCompletionTransition(input);
  if (!completedNow || !input.toAssigneeUserId) return event;

  const journey = await tx.userJourney.findFirst({
    where: { userId: input.toAssigneeUserId, status: "ACTIVE", joinedAt: { lte: input.completedAt! } },
    orderBy: { joinedAt: "desc" },
    include: { ruleSet: true },
  });
  if (!journey) return event;

  const assignmentEvent = input.fromAssigneeUserId !== input.toAssigneeUserId
    ? null
    : await tx.workCardEvent.findFirst({
        where: {
          workCardIdSnapshot: input.cardId,
          toAssigneeUserId: input.toAssigneeUserId,
          eventType: { in: ["CARD_CREATED", "ASSIGNEE_CHANGED"] },
          id: { not: event.id },
        },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      });
  const assignedAt = assignmentEvent?.occurredAt ?? input.createdAt;
  const timezone = journey.timezone;
  const important = !!input.label && input.label.trim().toLocaleUpperCase() === journey.ruleSet.importantLabel.trim().toLocaleUpperCase();
  const rules = {
    earlyCompletionPoints: journey.ruleSet.earlyCompletionPoints,
    onTimeCompletionPoints: journey.ruleSet.onTimeCompletionPoints,
    importantWorkBonus: journey.ruleSet.importantWorkBonus,
    assignedAndCompletedSameDayBonus: journey.ruleSet.assignedAndCompletedSameDayBonus,
    overdueFirstDayPenalty: journey.ruleSet.overdueFirstDayPenalty,
    overdueAdditionalDayPenalty: journey.ruleSet.overdueAdditionalDayPenalty,
    maxOverduePenalty: journey.ruleSet.maxOverduePenalty,
  };
  const completionEntries = scoreWorkspaceCompletion({
    dueAt: input.toDueAt,
    completedAt: input.completedAt!,
    assignedAt,
    important,
    timezone,
  }, rules);
  const localDate = isoInZone(input.completedAt!, timezone);

  await createDisciplineEntries(tx, completionEntries.map((score) => ({
    userId: input.toAssigneeUserId!,
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

  if (input.toDueAt && input.completedAt! > input.toDueAt) {
    const effectivePenaltyStart = [input.toDueAt, assignedAt, journey.joinedAt].reduce((latest, date) => date > latest ? date : latest);
    const overdueEntries = scoreOverdueDays({ dueAt: effectivePenaltyStart, throughAt: input.completedAt!, timezone }, rules);
    await createDisciplineEntries(tx, overdueEntries.map((score) => ({
      userId: input.toAssigneeUserId!,
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

  return event;
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
      assigneeUserId: userId,
      dueDate: { lt: throughAt },
      list: { name: { not: "listDone" } },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      createdAt: true,
      assigneeUserId: true,
      list: { select: { name: true } },
    },
  });
  if (!cards.length) return 0;

  const assignmentEvents = await db.workCardEvent.findMany({
    where: {
      workCardIdSnapshot: { in: cards.map((card) => card.id) },
      toAssigneeUserId: userId,
      eventType: { in: ["CARD_CREATED", "ASSIGNEE_CHANGED"] },
    },
    orderBy: { occurredAt: "desc" },
    select: { workCardIdSnapshot: true, occurredAt: true },
  });
  const assignedAt = new Map<string, Date>();
  for (const event of assignmentEvents) if (!assignedAt.has(event.workCardIdSnapshot)) assignedAt.set(event.workCardIdSnapshot, event.occurredAt);

  const rules = {
    earlyCompletionPoints: journey.ruleSet.earlyCompletionPoints,
    onTimeCompletionPoints: journey.ruleSet.onTimeCompletionPoints,
    importantWorkBonus: journey.ruleSet.importantWorkBonus,
    assignedAndCompletedSameDayBonus: journey.ruleSet.assignedAndCompletedSameDayBonus,
    overdueFirstDayPenalty: journey.ruleSet.overdueFirstDayPenalty,
    overdueAdditionalDayPenalty: journey.ruleSet.overdueAdditionalDayPenalty,
    maxOverduePenalty: journey.ruleSet.maxOverduePenalty,
  };
  const entries = cards.flatMap((card) => {
    if (!card.dueDate) return [];
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
      idempotencyKey: workspaceScoreIdempotencyKey(card.id, score.code, score.localDate),
      dueAtSnapshot: card.dueDate,
      statusSnapshot: card.list.name,
      assigneeUserIdSnapshot: userId,
      occurredAt: new Date(`${score.localDate}T12:00:00.000Z`),
    }));
  });

  if (!entries.length) return 0;
  const result = await db.disciplineTransaction.createMany({ data: entries, skipDuplicates: true });
  return result.count;
}

export const DEFAULT_LEDGER_RULES = DEFAULT_WORKSPACE_SCORE_RULES;