import "server-only";
import { addDays, fromDbDate, todayISO } from "@/lib/dates";
import { db } from "@/lib/db";

export async function syncJourneyAchievements(userId: string) {
  const journey = await db.userJourney.findFirst({
    where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
    orderBy: { joinedAt: "desc" },
    include: { program: true },
  });
  if (!journey) return 0;

  const [definitions, completedDays, records, discipline, onTime, level3, level4] = await Promise.all([
    db.journeyAchievementDefinition.findMany({ where: { programId: journey.programId, active: true } }),
    db.journeyDayRecord.count({ where: { journeyId: journey.id, status: "COMPLETED" } }),
    db.journeyDayRecord.findMany({
      where: { journeyId: journey.id, date: { lte: new Date(`${todayISO(journey.timezone)}T00:00:00.000Z`) } },
      orderBy: { date: "desc" },
      take: 181,
      select: { date: true, status: true },
    }),
    db.disciplineTransaction.aggregate({ where: { journeyId: journey.id }, _sum: { points: true } }),
    db.disciplineTransaction.count({ where: { journeyId: journey.id, eventType: { in: ["WORK_COMPLETED_EARLY", "WORK_COMPLETED_ON_TIME"] } } }),
    db.journeyMonthlyChallengeCompletion.findFirst({ where: { journeyId: journey.id, challenge: { level: { number: 3 } }, passed: true }, select: { id: true } }),
    db.journeyMonthlyChallengeCompletion.findFirst({ where: { journeyId: journey.id, challenge: { level: { number: 4 } }, passed: true }, select: { id: true } }),
  ]);

  let streak = 0;
  const today = todayISO(journey.timezone);
  for (const record of records) {
    const date = fromDbDate(record.date);
    if (date === today && record.status === "IN_PROGRESS") continue;
    if (record.status === "REST") continue;
    if (record.status !== "COMPLETED") break;
    streak++;
    if (streak >= 1000) break;
  }

  const values: Record<string, number> = {
    completed_days: completedDays,
    consecutive_completed_days: streak,
    workspace_on_time: onTime,
    discipline_points: discipline._sum.points ?? 0,
    monthly_challenge_level_3: level3 ? 1 : 0,
    monthly_challenge_level_4: level4 ? 1 : 0,
    journey_complete: journey.status === "COMPLETED" ? 1 : 0,
  };
  const earned = definitions.filter((definition) => {
    const value = values[definition.metric];
    return value != null && value >= (definition.threshold ?? 1);
  });
  if (!earned.length) return 0;

  return db.$transaction(async (tx) => {
    const existing = await tx.journeyAchievement.findMany({
      where: { journeyId: journey.id, definitionId: { in: earned.map((item) => item.id) } },
      select: { definitionId: true },
    });
    const alreadyEarned = new Set(existing.map((item) => item.definitionId));
    const newAwards = earned.filter((item) => !alreadyEarned.has(item.id));
    if (!newAwards.length) return 0;

    await tx.journeyAchievement.createMany({
      data: newAwards.map((definition) => {
        const value = values[definition.metric] ?? 0;
        return { journeyId: journey.id, definitionId: definition.id, snapshot: { metric: definition.metric, value, threshold: definition.threshold } };
      }),
      skipDuplicates: true,
    });

    for (const definition of newAwards) {
      await tx.journeyXPTransaction.upsert({
        where: { idempotencyKey: `achievement:${journey.id}:${definition.id}` },
        update: {},
        create: {
          userId,
          journeyId: journey.id,
          eventType: "ACHIEVEMENT_AWARDED",
          xp: definition.xpReward,
          reason: definition.title,
          idempotencyKey: `achievement:${journey.id}:${definition.id}`,
        },
      });
    }
    return newAwards.length;
  });
}