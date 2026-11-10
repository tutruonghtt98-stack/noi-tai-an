"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import type { Prisma } from "@/generated/prisma/client";

const missionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1200),
  objective: z.string().trim().min(1).max(600),
  type: z.enum(["HEALTH", "PERSONAL_GROWTH", "PRODUCTIVITY", "REFLECTION"]),
  suggestedMinutes: z.number().int().min(1).max(360).nullable(),
  xpReward: z.number().int().min(0).max(1000),
  completionCriteria: z.string().trim().min(1).max(800),
  active: z.boolean(),
});

const weeklySchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1200),
  completionCriteria: z.string().trim().min(1).max(800),
  xpReward: z.number().int().min(0).max(1000),
  active: z.boolean(),
});

const monthlySchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1200),
  completionCriteria: z.string().trim().min(1).max(4000),
  xpReward: z.number().int().min(0).max(5000),
  active: z.boolean(),
});

const rulesSchema = z.object({
  missionWeight: z.number().int().min(0).max(100),
  habitWeight: z.number().int().min(0).max(100),
  workspaceWeight: z.number().int().min(0).max(100),
  levelCompletionThreshold: z.number().int().min(50).max(100),
  earlyCompletionPoints: z.number().int().min(0).max(1000),
  onTimeCompletionPoints: z.number().int().min(0).max(1000),
  importantWorkBonus: z.number().int().min(0).max(1000),
  assignedAndCompletedSameDayBonus: z.number().int().min(0).max(1000),
  overdueFirstDayPenalty: z.number().int().min(0).max(1000),
  overdueAdditionalDayPenalty: z.number().int().min(0).max(1000),
  maxOverduePenalty: z.number().int().min(0).max(100_000).nullable(),
  importantLabel: z.string().trim().min(1).max(30),
}).refine((value) => value.missionWeight + value.habitWeight + value.workspaceWeight === 100, "Điểm trọng số phải cộng thành 100.");

const levelSchema = z.object({
  title: z.string().trim().min(1).max(100),
  tagline: z.string().trim().max(160),
  description: z.string().trim().min(1).max(1200),
  objective: z.string().trim().min(1).max(1200),
  skills: z.string().trim().min(1).max(1200),
  reflectionQuestions: z.string().trim().min(1).max(3000),
  completionThreshold: z.number().int().min(50).max(100),
});

const dailyChallengeSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1200),
  completionCriteria: z.string().trim().min(1).max(800),
  xpReward: z.number().int().min(0).max(1000),
  active: z.boolean(),
});

const quoteSchema = z.object({
  quote: z.string().trim().min(1).max(500),
  author: z.string().trim().max(120),
  active: z.boolean(),
});

const achievementSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(600),
  metric: z.string().trim().min(1).max(100),
  threshold: z.number().int().min(0).max(100_000).nullable(),
  xpReward: z.number().int().min(0).max(5000),
  active: z.boolean(),
});

function auditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type JourneyContentTarget = "level" | "mission" | "daily" | "weekly" | "monthly" | "quote" | "achievement";

async function forkProgramForContentEdit(tx: Prisma.TransactionClient, adminId: string, type: JourneyContentTarget, entityId: string) {
  let programId: string;
  let targetKey: Record<string, string | number | null>;

  if (type === "level") {
    const row = await tx.journeyLevel.findUnique({ where: { id: entityId }, select: { programId: true, number: true } });
    if (!row) throw new UserError("NOT_FOUND");
    programId = row.programId;
    targetKey = { number: row.number };
  } else if (type === "mission") {
    const row = await tx.journeyMission.findUnique({ where: { id: entityId }, select: { dayInLevel: true, sequence: true, level: { select: { programId: true, number: true } } } });
    if (!row) throw new UserError("NOT_FOUND");
    programId = row.level.programId;
    targetKey = { levelNumber: row.level.number, dayInLevel: row.dayInLevel, sequence: row.sequence };
  } else if (type === "daily") {
    const row = await tx.journeyDailyChallenge.findUnique({ where: { id: entityId }, select: { programId: true, journeyDay: true } });
    if (!row) throw new UserError("NOT_FOUND");
    programId = row.programId;
    targetKey = { journeyDay: row.journeyDay };
  } else if (type === "weekly") {
    const row = await tx.journeyWeeklyChallenge.findUnique({ where: { id: entityId }, select: { programId: true, weekNumber: true } });
    if (!row) throw new UserError("NOT_FOUND");
    programId = row.programId;
    targetKey = { weekNumber: row.weekNumber };
  } else if (type === "monthly") {
    const row = await tx.journeyMonthlyChallenge.findUnique({ where: { id: entityId }, select: { level: { select: { programId: true, number: true } } } });
    if (!row) throw new UserError("NOT_FOUND");
    programId = row.level.programId;
    targetKey = { levelNumber: row.level.number };
  } else if (type === "quote") {
    const row = await tx.journeyQuote.findUnique({ where: { id: entityId }, select: { programId: true, dayNumber: true } });
    if (!row) throw new UserError("NOT_FOUND");
    programId = row.programId;
    targetKey = { dayNumber: row.dayNumber };
  } else {
    const row = await tx.journeyAchievementDefinition.findUnique({ where: { id: entityId }, select: { programId: true, code: true } });
    if (!row) throw new UserError("NOT_FOUND");
    programId = row.programId;
    targetKey = { code: row.code };
  }

  const activeJourneys = await tx.userJourney.count({ where: { programId, status: "ACTIVE" } });
  if (!activeJourneys) return entityId;

  const source = await tx.journeyProgram.findUnique({
    where: { id: programId },
    include: {
      levels: { orderBy: { number: "asc" }, include: { missions: true, weeklyChallenges: true, monthlyChallenge: true, achievements: true } },
      dailyChallenges: true,
      quotes: true,
      achievements: true,
      ruleSets: true,
    },
  });
  if (!source) throw new UserError("NOT_FOUND");

  const fork = await tx.journeyProgram.create({
    data: {
      code: source.code,
      version: source.version + 1,
      durationDays: source.durationDays,
      title: source.title,
      description: source.description,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  const levelIds = new Map<number, string>();
  const levelNumberById = new Map<string, number>();
  for (const level of source.levels) {
    const cloned = await tx.journeyLevel.create({
      data: {
        programId: fork.id,
        number: level.number,
        startDay: level.startDay,
        endDay: level.endDay,
        slug: level.slug,
        title: level.title,
        tagline: level.tagline,
        description: level.description,
        objective: level.objective,
        skills: level.skills,
        reflectionQuestions: level.reflectionQuestions,
        completionCriteria: level.completionCriteria ?? undefined,
        reportSections: level.reportSections ?? undefined,
        completionThreshold: level.completionThreshold,
      },
    });
    levelIds.set(level.number, cloned.id);
    levelNumberById.set(level.id, level.number);

    if (level.missions.length) {
      await tx.journeyMission.createMany({
        data: level.missions.map((mission) => ({
          levelId: cloned.id,
          dayInLevel: mission.dayInLevel,
          sequence: mission.sequence,
          title: mission.title,
          description: mission.description,
          objective: mission.objective,
          type: mission.type,
          suggestedMinutes: mission.suggestedMinutes,
          xpReward: mission.xpReward,
          completionCriteria: mission.completionCriteria,
          active: mission.active,
        })),
      });
    }
    if (level.weeklyChallenges.length) {
      await tx.journeyWeeklyChallenge.createMany({
        data: level.weeklyChallenges.map((challenge) => ({
          programId: fork.id,
          levelId: cloned.id,
          weekNumber: challenge.weekNumber,
          startDay: challenge.startDay,
          endDay: challenge.endDay,
          title: challenge.title,
          description: challenge.description,
          completionCriteria: challenge.completionCriteria,
          xpReward: challenge.xpReward,
          active: challenge.active,
        })),
      });
    }
    if (level.monthlyChallenge) {
      await tx.journeyMonthlyChallenge.create({
        data: {
          levelId: cloned.id,
          title: level.monthlyChallenge.title,
          description: level.monthlyChallenge.description,
          completionCriteria: auditJson(level.monthlyChallenge.completionCriteria),
          xpReward: level.monthlyChallenge.xpReward,
          active: level.monthlyChallenge.active,
        },
      });
    }
  }

  if (source.dailyChallenges.length) {
    await tx.journeyDailyChallenge.createMany({
      data: source.dailyChallenges.map((challenge) => ({
        programId: fork.id,
        journeyDay: challenge.journeyDay,
        title: challenge.title,
        description: challenge.description,
        completionCriteria: challenge.completionCriteria,
        xpReward: challenge.xpReward,
        active: challenge.active,
      })),
    });
  }
  if (source.quotes.length) {
    await tx.journeyQuote.createMany({
      data: source.quotes.map((quote) => ({ programId: fork.id, quote: quote.quote, author: quote.author, dayNumber: quote.dayNumber, active: quote.active })),
    });
  }
  if (source.achievements.length) {
    await tx.journeyAchievementDefinition.createMany({
      data: source.achievements.map((achievement) => ({
        programId: fork.id,
        levelId: achievement.levelId ? levelIds.get(levelNumberById.get(achievement.levelId)!) ?? null : null,
        code: achievement.code,
        title: achievement.title,
        description: achievement.description,
        metric: achievement.metric,
        threshold: achievement.threshold,
        xpReward: achievement.xpReward,
        active: achievement.active,
      })),
    });
  }
  if (source.ruleSets.length) {
    await tx.journeyRuleSet.createMany({
      data: source.ruleSets.map((rules) => ({
        programId: fork.id,
        version: rules.version,
        missionWeight: rules.missionWeight,
        habitWeight: rules.habitWeight,
        workspaceWeight: rules.workspaceWeight,
        levelCompletionThreshold: rules.levelCompletionThreshold,
        earlyCompletionPoints: rules.earlyCompletionPoints,
        onTimeCompletionPoints: rules.onTimeCompletionPoints,
        importantWorkBonus: rules.importantWorkBonus,
        assignedAndCompletedSameDayBonus: rules.assignedAndCompletedSameDayBonus,
        overdueFirstDayPenalty: rules.overdueFirstDayPenalty,
        overdueAdditionalDayPenalty: rules.overdueAdditionalDayPenalty,
        maxOverduePenalty: rules.maxOverduePenalty,
        importantLabel: rules.importantLabel,
        teamAssignmentPolicy: rules.teamAssignmentPolicy,
        publishedAt: rules.publishedAt ? new Date() : null,
      })),
    });
  }

  await tx.journeyAdminAudit.create({
    data: {
      adminId,
      action: "FORK_CONTENT_VERSION",
      entityType: "JourneyProgram",
      entityId: fork.id,
      before: auditJson({ id: source.id, version: source.version }),
      after: auditJson({ id: fork.id, version: fork.version }),
    },
  });

  if (type === "level") {
    return (await tx.journeyLevel.findUnique({ where: { programId_number: { programId: fork.id, number: targetKey.number as number } } }))!.id;
  }
  if (type === "mission") {
    const levelId = levelIds.get(targetKey.levelNumber as number)!;
    return (await tx.journeyMission.findUnique({ where: { levelId_dayInLevel_sequence: { levelId, dayInLevel: targetKey.dayInLevel as number, sequence: targetKey.sequence as number } } }))!.id;
  }
  if (type === "daily") {
    return (await tx.journeyDailyChallenge.findUnique({ where: { programId_journeyDay: { programId: fork.id, journeyDay: targetKey.journeyDay as number } } }))!.id;
  }
  if (type === "weekly") {
    return (await tx.journeyWeeklyChallenge.findUnique({ where: { programId_weekNumber: { programId: fork.id, weekNumber: targetKey.weekNumber as number } } }))!.id;
  }
  if (type === "monthly") {
    const levelId = levelIds.get(targetKey.levelNumber as number)!;
    return (await tx.journeyMonthlyChallenge.findUnique({ where: { levelId } }))!.id;
  }
  if (type === "quote") {
    const quote = await tx.journeyQuote.findFirst({ where: { programId: fork.id, dayNumber: targetKey.dayNumber as number } });
    if (!quote) throw new UserError("NOT_FOUND");
    return quote.id;
  }
  return (await tx.journeyAchievementDefinition.findUnique({ where: { programId_code: { programId: fork.id, code: targetKey.code as string } } }))!.id;
}

export async function adminUpdateJourneyMission(id: string, input: z.input<typeof missionSchema>) {
  return run(async () => {
    const admin = await requireAdmin();
    const missionId = z.string().cuid().parse(id);
    const data = missionSchema.parse(input);
    await db.$transaction(async (tx) => {
      const targetId = await forkProgramForContentEdit(tx, admin.id, "mission", missionId);
      const before = await tx.journeyMission.findUnique({ where: { id: targetId } });
      if (!before) throw new UserError("NOT_FOUND");
      const after = await tx.journeyMission.update({ where: { id: targetId }, data });
      await tx.journeyAdminAudit.create({
        data: { adminId: admin.id, action: "UPDATE", entityType: "JourneyMission", entityId: targetId, before: auditJson(before), after: auditJson(after) },
      });
    });
    revalidatePath("/admin/journey");
    revalidatePath("/journey");
  });
}

export async function adminUpdateJourneyWeeklyChallenge(id: string, input: z.input<typeof weeklySchema>) {
  return run(async () => {
    const admin = await requireAdmin();
    const challengeId = z.string().cuid().parse(id);
    const data = weeklySchema.parse(input);
    await db.$transaction(async (tx) => {
      const targetId = await forkProgramForContentEdit(tx, admin.id, "weekly", challengeId);
      const before = await tx.journeyWeeklyChallenge.findUnique({ where: { id: targetId } });
      if (!before) throw new UserError("NOT_FOUND");
      const after = await tx.journeyWeeklyChallenge.update({ where: { id: targetId }, data });
      await tx.journeyAdminAudit.create({
        data: { adminId: admin.id, action: "UPDATE", entityType: "JourneyWeeklyChallenge", entityId: targetId, before: auditJson(before), after: auditJson(after) },
      });
    });
    revalidatePath("/admin/journey");
    revalidatePath("/journey");
  });
}

export async function adminUpdateJourneyMonthlyChallenge(id: string, input: z.input<typeof monthlySchema>) {
  return run(async () => {
    const admin = await requireAdmin();
    const challengeId = z.string().cuid().parse(id);
    const parsed = monthlySchema.parse(input);
    const criteria = parsed.completionCriteria.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (!criteria.length) throw new UserError("VALIDATION");
    const data = {
      ...parsed,
      completionCriteria: criteria as Prisma.InputJsonValue,
    };
    await db.$transaction(async (tx) => {
      const targetId = await forkProgramForContentEdit(tx, admin.id, "monthly", challengeId);
      const before = await tx.journeyMonthlyChallenge.findUnique({ where: { id: targetId } });
      if (!before) throw new UserError("NOT_FOUND");
      const after = await tx.journeyMonthlyChallenge.update({ where: { id: targetId }, data });
      await tx.journeyAdminAudit.create({
        data: { adminId: admin.id, action: "UPDATE", entityType: "JourneyMonthlyChallenge", entityId: targetId, before: auditJson(before), after: auditJson(after) },
      });
    });
    revalidatePath("/admin/journey");
    revalidatePath("/journey");
  });
}

export async function adminUpdateJourneyRules(id: string, input: z.input<typeof rulesSchema>) {
  return run(async () => {
    const admin = await requireAdmin();
    const ruleSetId = z.string().cuid().parse(id);
    const data = rulesSchema.parse(input);
    await db.$transaction(async (tx) => {
      const before = await tx.journeyRuleSet.findUnique({ where: { id: ruleSetId } });
      if (!before) throw new UserError("NOT_FOUND");
      const after = await tx.journeyRuleSet.create({
        data: { ...data, programId: before.programId, version: before.version + 1, publishedAt: new Date() },
      });
      await tx.journeyAdminAudit.create({
        data: { adminId: admin.id, action: "UPDATE_RULES", entityType: "JourneyRuleSet", entityId: ruleSetId, before: auditJson(before), after: auditJson(after) },
      });
    });
    revalidatePath("/admin/journey");
    revalidatePath("/journey");
  });
}

export async function adminUpdateJourneyLevel(id: string, input: z.input<typeof levelSchema>) {
  return run(async () => {
    const admin = await requireAdmin();
    const levelId = z.string().cuid().parse(id);
    const parsed = levelSchema.parse(input);
    const data = {
      ...parsed,
      tagline: parsed.tagline || null,
      skills: parsed.skills.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      reflectionQuestions: parsed.reflectionQuestions.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    };
    await db.$transaction(async (tx) => {
      const targetId = await forkProgramForContentEdit(tx, admin.id, "level", levelId);
      const before = await tx.journeyLevel.findUnique({ where: { id: targetId } });
      if (!before) throw new UserError("NOT_FOUND");
      const after = await tx.journeyLevel.update({ where: { id: targetId }, data });
      await tx.journeyAdminAudit.create({
        data: { adminId: admin.id, action: "UPDATE", entityType: "JourneyLevel", entityId: targetId, before: auditJson(before), after: auditJson(after) },
      });
    });
    revalidatePath("/admin/journey");
    revalidatePath("/journey");
  });
}

export async function adminUpdateJourneyDailyChallenge(id: string, input: z.input<typeof dailyChallengeSchema>) {
  return run(async () => {
    const admin = await requireAdmin();
    const challengeId = z.string().cuid().parse(id);
    const data = dailyChallengeSchema.parse(input);
    await db.$transaction(async (tx) => {
      const targetId = await forkProgramForContentEdit(tx, admin.id, "daily", challengeId);
      const before = await tx.journeyDailyChallenge.findUnique({ where: { id: targetId } });
      if (!before) throw new UserError("NOT_FOUND");
      const after = await tx.journeyDailyChallenge.update({ where: { id: targetId }, data });
      await tx.journeyAdminAudit.create({
        data: { adminId: admin.id, action: "UPDATE", entityType: "JourneyDailyChallenge", entityId: targetId, before: auditJson(before), after: auditJson(after) },
      });
    });
    revalidatePath("/admin/journey");
    revalidatePath("/journey");
  });
}

export async function adminUpdateJourneyQuote(id: string, input: z.input<typeof quoteSchema>) {
  return run(async () => {
    const admin = await requireAdmin();
    const quoteId = z.string().cuid().parse(id);
    const parsed = quoteSchema.parse(input);
    const data = { ...parsed, author: parsed.author || null };
    await db.$transaction(async (tx) => {
      const targetId = await forkProgramForContentEdit(tx, admin.id, "quote", quoteId);
      const before = await tx.journeyQuote.findUnique({ where: { id: targetId } });
      if (!before) throw new UserError("NOT_FOUND");
      const after = await tx.journeyQuote.update({ where: { id: targetId }, data });
      await tx.journeyAdminAudit.create({
        data: { adminId: admin.id, action: "UPDATE", entityType: "JourneyQuote", entityId: targetId, before: auditJson(before), after: auditJson(after) },
      });
    });
    revalidatePath("/admin/journey");
    revalidatePath("/journey");
  });
}

export async function adminUpdateJourneyAchievement(id: string, input: z.input<typeof achievementSchema>) {
  return run(async () => {
    const admin = await requireAdmin();
    const achievementId = z.string().cuid().parse(id);
    const data = achievementSchema.parse(input);
    await db.$transaction(async (tx) => {
      const targetId = await forkProgramForContentEdit(tx, admin.id, "achievement", achievementId);
      const before = await tx.journeyAchievementDefinition.findUnique({ where: { id: targetId } });
      if (!before) throw new UserError("NOT_FOUND");
      const after = await tx.journeyAchievementDefinition.update({ where: { id: targetId }, data });
      await tx.journeyAdminAudit.create({
        data: { adminId: admin.id, action: "UPDATE", entityType: "JourneyAchievementDefinition", entityId: targetId, before: auditJson(before), after: auditJson(after) },
      });
    });
    revalidatePath("/admin/journey");
    revalidatePath("/journey");
  });
}