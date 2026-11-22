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
        const totalUnits = currentLevel.endDay - currentLevel.startDay + 1;
        const [completedUnits, monthlyChallenge, monthlyCompletion, review] = await Promise.all([
          tx.journeyDayRecord.count({
            where: {
              journeyId: current.id,
              journeyDay: { gte: currentLevel.startDay, lte: currentLevel.endDay },
              status: { in: ["COMPLETED", "REST"] },
            },
          }),
          tx.journeyMonthlyChallenge.findUnique({ where: { levelId: currentLevel.id }, select: { id: true } }),
          tx.journeyMonthlyChallengeCompletion.findFirst({ where: { journeyId: current.id, challenge: { levelId: currentLevel.id }, passed: true }, select: { id: true } }),
          tx.journeyLevelReview.findUnique({ where: { journeyId_levelId: { journeyId: current.id, levelId: currentLevel.id } }, select: { passed: true } }),
        ]);
        const gate = getJourneyLevelGate({
          completedUnits,
          totalUnits,
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
      return { journey, today, level: null, dayRecord: null, dailyChallenge: null, weeklyChallenge: null, monthlyChallenge: null, levelReview: null, achievements, habits: [], workspaceTasks: [], dailyScore: 0, weekNumber: 0, completedWeeklyOptionIds: [] };
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

  if (!level) return { journey, today, level: null, dayRecord: null, dailyChallenge: null, weeklyChallenge: null, monthlyChallenge: null, levelReview: null, achievements: [], habits: [], workspaceTasks: [], dailyScore: 0, weekNumber: 0, completedWeeklyOptionIds: [] };

  const weekNumber = getJourneyWeekNumber(level.number, level.startDay, dayNumber);
  const [dayRecord, weeklyChallenge, monthlyChallenge, levelReview, habits, workspaceCards, workspaceDue, commitmentChecks] = await Promise.all([
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
        assignees: { some: { userId: user.id } },
        dueDate: { gte: todayDate, lt: tomorrowDate },
        list: { name: { not: "listDone" } },
      },
      select: { id: true, title: true, dueDate: true, completedAt: true, list: { select: { name: true, board: { select: { id: true, name: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
    db.workCard.findMany({
      where: {
        assignees: { some: { userId: user.id } },
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
  const dueHabits = habits.filter((habit) => habit.stats.scheduledToday);
  const doneHabits = dueHabits.filter((habit) => habit.stats.doneToday);
  const dueWorkspace = workspaceDue.filter((card) => card.dueDate);
  const completedOnTime = dueWorkspace.filter((card) => card.completedAt && card.completedAt <= card.dueDate!).length;
  const dailyScore = calculateJourneyDailyScore({
    // Không còn Nhiệm vụ chính: due = 0 khiến thành phần này bị loại và trọng số
    // được chia lại cho thói quen/Workspace.
    missionsDone: 0,
    missionsDue: 0,
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
    personalMissions,
    dailyChallenge,
    weeklyChallenge,
    weekNumber,
    monthlyChallenge,
    levelReview,
    achievements,
    habits,
    workspaceTasks: workspaceCards.map((card) => ({
      id: card.id,
      title: card.title,
      dueDate: card.dueDate,
      completedAt: card.completedAt,
      listName: card.list.name,
      boardName: card.list.board.name,
    })),
    dailyScore,
    completedWeeklyOptionIds: commitmentChecks.map((c) => c.optionId),
  };
}

/**
 * Tín hiệu "hôm nay đã có hoạt động" của Hành trình: có ít nhất 1 thói quen
 * cam kết hôm nay đã làm, hoặc người dùng đã tích/gửi 1 việc Workspace hôm
 * nay (WorkCardEvent chuyển sang "listReview"/"listDone" do chính họ thực hiện).
 * Dùng WorkCardEvent thay vì completedAt vì người được giao không phải chủ bảng
 * tích xong thì thẻ chỉ sang "Xem lại" — completedAt vẫn null.
 */
export async function hasJourneyActivityToday(
  user: CurrentUser,
  dashboard: NonNullable<Awaited<ReturnType<typeof getJourneyDashboard>>>,
): Promise<boolean> {
  const habitDone = dashboard.habits.some((habit) => habit.stats.scheduledToday && habit.stats.doneToday);
  if (habitDone) return true;

  // occurredAt là mốc thời gian thật, nên "hôm nay" phải tính theo múi giờ của
  // hành trình: lấy cửa sổ rộng (đủ phủ mọi múi giờ UTC-12..UTC+14) rồi lọc lại
  // bằng isoInZone, tránh lệch ngày ở các giờ đầu/cuối ngày địa phương.
  const timeZone = dashboard.journey.timezone;
  const today = todayISO(timeZone);
  const events = await db.workCardEvent.findMany({
    where: {
      actorUserId: user.id,
      occurredAt: { gte: toDbDate(addDays(today, -1)), lt: toDbDate(addDays(today, 2)) },
      toStatus: { in: ["listReview", "listDone"] },
    },
    select: { occurredAt: true, fromStatus: true, toStatus: true },
  });
  // toStatus được ghi trên MỌI sự kiện của thẻ (kể cả chỉ sửa tiêu đề/hạn khi thẻ
  // đã nằm sẵn ở "Xem lại"/"Hoàn thành"), nên chỉ tính khi thẻ thực sự chuyển
  // vào cột đó (fromStatus khác toStatus; tạo thẻ thẳng vào cột thì fromStatus = null).
  return events.some(
    (event) => event.fromStatus !== event.toStatus && isoInZone(event.occurredAt, timeZone) === today,
  );
}