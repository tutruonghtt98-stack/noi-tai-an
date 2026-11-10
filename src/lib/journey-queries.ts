import "server-only";
import { db } from "@/lib/db";
import { addDays, fromDbDate, isoInZone, toDbDate, todayISO } from "@/lib/dates";
import { getHabitsWithStats } from "@/lib/queries";
import { getJourneyCalendarTransition, getJourneyLevelGate, getJourneyWeekNumber } from "@/lib/journey-calendar";
import { calculateJourneyDailyScore } from "@/lib/journey-scoring";
import { syncJourneyAchievements } from "@/lib/journey-achievements";
import type { CurrentUser } from "@/lib/session";

export async function getJourneyDashboard(user: CurrentUser) {
  const activeJourney = await db.userJourney.findFirst({
    where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } },
    orderBy: { joinedAt: "desc" },
  });
  if (!activeJourney) return null;

  const today = todayISO(activeJourney.timezone);
  const todayDate = toDbDate(today);
  const tomorrowDate = toDbDate(addDays(today, 1));

  const journey = await db.$transaction(async (tx) => {
    const current = await tx.userJourney.findUnique({ where: { id: activeJourney.id } });
    if (!current || current.status !== "ACTIVE") return null;

    const last = await tx.journeyDayRecord.findFirst({
      where: { journeyId: current.id },
      orderBy: { date: "desc" },
      select: { id: true, date: true, journeyDay: true, status: true },
    });

    let transition = getJourneyCalendarTransition({
      today,
      currentDay: current.currentDay,
      lastRecord: last
        ? { date: fromDbDate(last.date), journeyDay: last.journeyDay, status: last.status }
        : null,
    });

    if (last && last.date < todayDate && transition.currentDay > current.currentDay) {
      const currentLevel = await tx.journeyLevel.findFirst({
        where: { programId: current.programId, startDay: { lte: current.currentDay }, endDay: { gte: current.currentDay } },
      });
      if (currentLevel && current.currentDay === currentLevel.endDay) {
        const [totalMissions, completedMissions, monthlyChallenge, monthlyCompletion, review] = await Promise.all([
          tx.journeyMission.count({ where: { levelId: currentLevel.id, active: true } }),
          tx.journeyMissionCompletion.count({ where: { journeyId: current.id, mission: { levelId: currentLevel.id, active: true } } }),
          tx.journeyMonthlyChallenge.findUnique({ where: { levelId: currentLevel.id }, select: { id: true } }),
          tx.journeyMonthlyChallengeCompletion.findFirst({ where: { journeyId: current.id, challenge: { levelId: currentLevel.id }, passed: true }, select: { id: true } }),
          tx.journeyLevelReview.findUnique({ where: { journeyId_levelId: { journeyId: current.id, levelId: currentLevel.id } }, select: { passed: true } }),
        ]);
        const gate = getJourneyLevelGate({
          completedMissions,
          totalMissions,
          thresholdPercent: currentLevel.completionThreshold,
          monthlyChallengeCompleted: !monthlyChallenge || !!monthlyCompletion,
          reviewPassed: !!review?.passed,
        });
        if (!gate.canAdvance) {
          transition = {
            ...transition,
            currentDay: current.currentDay,
            journeyCompleted: false,
            missedDates: transition.missedDates.map((missed) => ({ ...missed, journeyDay: current.currentDay })),
          };
        }
      }
    }

    if (last && last.date < todayDate && last.status === "IN_PROGRESS") {
      await tx.journeyDayRecord.updateMany({
        where: { id: last.id, status: "IN_PROGRESS" },
        data: { status: "MISSED" },
      });
    }

    for (const missed of transition.missedDates) {
      await tx.journeyDayRecord.upsert({
        where: { journeyId_date: { journeyId: current.id, date: toDbDate(missed.date) } },
        update: {},
        create: { journeyId: current.id, journeyDay: missed.journeyDay, date: toDbDate(missed.date), status: "MISSED" },
      });
    }

    const nextStatus = transition.journeyCompleted ? "COMPLETED" : current.status;
    await tx.userJourney.updateMany({
      where: { id: current.id, currentDay: current.currentDay, status: "ACTIVE" },
      data: {
        currentDay: transition.currentDay,
        status: nextStatus,
        ...(transition.journeyCompleted ? { completedAt: new Date() } : {}),
      },
    });

    return tx.userJourney.findUnique({
      where: { id: current.id },
      include: {
        program: true,
        ruleSet: true,
      },
    });
  });

  if (!journey) return null;
  if (journey.status === "COMPLETED") {
    await syncJourneyAchievements(user.id);
    const achievements = await db.journeyAchievement.findMany({ where: { journeyId: journey.id }, include: { definition: true }, orderBy: { awardedAt: "asc" } });
      return { journey, today, level: null, dayRecord: null, missions: [], recoveryMissions: [], dailyChallenge: null, weeklyChallenge: null, monthlyChallenge: null, levelReview: null, achievements, habits: [], workspaceCards: [], dailyScore: 0, weekNumber: 0, completedWeeklyOptionIds: [] };
  }
  const dayNumber = Math.min(journey.currentDay, journey.program.durationDays);
  const [level, dailyChallenge] = await Promise.all([
    db.journeyLevel.findFirst({
      where: { programId: journey.programId, startDay: { lte: dayNumber }, endDay: { gte: dayNumber } },
    }),
    db.journeyDailyChallenge.findUnique({
      where: { programId_journeyDay: { programId: journey.programId, journeyDay: dayNumber } },
    }),
  ]);

  if (!level) return { journey, today, level: null, dayRecord: null, missions: [], recoveryMissions: [], dailyChallenge: null, weeklyChallenge: null, monthlyChallenge: null, levelReview: null, achievements: [], habits: [], workspaceCards: [], dailyScore: 0, weekNumber: 0, completedWeeklyOptionIds: [] };

  const dayInLevel = dayNumber - level.startDay + 1;
  const weekNumber = getJourneyWeekNumber(level.number, level.startDay, dayNumber);
  const [dayRecord, missions, weeklyChallenge, monthlyChallenge, levelReview, habits, workspaceCards, workspaceDue, commitmentChecks] = await Promise.all([
    db.journeyDayRecord.upsert({
      where: { journeyId_date: { journeyId: journey.id, date: todayDate } },
      update: {},
      create: {
        journeyId: journey.id,
        journeyDay: dayNumber,
        date: todayDate,
        ...(dailyChallenge ? { dailyChallengeId: dailyChallenge.id } : {}),
      },
      include: { reflection: true, expense: true },
    }),
    db.journeyMission.findMany({
      where: { levelId: level.id, dayInLevel, active: true },
      orderBy: { sequence: "asc" },
      include: { completions: { where: { journeyId: journey.id }, select: { id: true, completedAt: true } } },
    }),
    db.journeyWeeklyChallenge.findUnique({
      where: { programId_weekNumber: { programId: journey.programId, weekNumber } },
      include: { completions: { where: { journeyId: journey.id } } },
    }),
    db.journeyMonthlyChallenge.findUnique({
      where: { levelId: level.id },
      include: { completions: { where: { journeyId: journey.id } } },
    }),
    db.journeyLevelReview.findUnique({ where: { journeyId_levelId: { journeyId: journey.id, levelId: level.id } } }),
    getHabitsWithStats(user, today),
    db.workCard.findMany({
      where: {
        assigneeUserId: user.id,
        dueDate: { gte: todayDate, lt: tomorrowDate },
        list: { name: { not: "listDone" } },
      },
      select: { id: true, title: true, dueDate: true, completedAt: true, list: { select: { name: true, board: { select: { id: true, name: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
    db.workCard.findMany({
      where: {
        assigneeUserId: user.id,
        dueDate: { gte: todayDate, lt: tomorrowDate },
      },
      select: { dueDate: true, completedAt: true },
    }),
    db.journeyCommitmentCheck.findMany({
      where: { journeyId: journey.id, weekNumber },
      select: { optionId: true },
    }),
  ]);

  if (!dayRecord.dailyChallengeId && dailyChallenge) {
    await db.journeyDayRecord.updateMany({
      where: { id: dayRecord.id, dailyChallengeId: null },
      data: { dailyChallengeId: dailyChallenge.id },
    });
    dayRecord.dailyChallengeId = dailyChallenge.id;
  }

  const personalMissions = await db.journeyPersonalMission.findMany({
    where: { journeyId: journey.id, OR: [{ dayRecordId: dayRecord.id }, { dayRecordId: null }] },
    orderBy: { createdAt: "asc" },
  });
  const recoveryMissions = dayNumber === level.endDay
    ? await db.journeyMission.findMany({
        where: { levelId: level.id, active: true, completions: { none: { journeyId: journey.id } } },
        orderBy: [{ dayInLevel: "asc" }, { sequence: "asc" }],
        include: { completions: { where: { journeyId: journey.id }, select: { id: true, completedAt: true } } },
      })
    : [];

  const missionCompletions = missions.filter((mission) => mission.completions.length > 0).length;
  const dueHabits = habits.filter((habit) => habit.stats.scheduledToday);
  const doneHabits = dueHabits.filter((habit) => habit.stats.doneToday);
  const dueWorkspace = workspaceDue.filter((card) => card.dueDate);
  const completedOnTime = dueWorkspace.filter((card) => card.completedAt && card.completedAt <= card.dueDate!).length;
  const dailyScore = calculateJourneyDailyScore({
    missionsDone: missionCompletions,
    missionsDue: missions.length,
    habitsDone: doneHabits.length,
    habitsDue: dueHabits.length,
    workspaceOnTime: completedOnTime,
    workspaceDue: dueWorkspace.length,
    weights: {
      missions: journey.ruleSet.missionWeight,
      habits: journey.ruleSet.habitWeight,
      workspace: journey.ruleSet.workspaceWeight,
    },
  });
  const achievements = await db.journeyAchievement.findMany({
    where: { journeyId: journey.id },
    include: { definition: true },
    orderBy: { awardedAt: "asc" },
  });

  return {
    journey,
    today,
    level,
    dayRecord,
    missions,
    recoveryMissions,
    personalMissions,
    dailyChallenge,
    weeklyChallenge,
    weekNumber,
    monthlyChallenge,
    levelReview,
    achievements,
    habits,
    workspaceCards,
    dailyScore,
    completedWeeklyOptionIds: commitmentChecks.map((c) => c.optionId),
  };
}