"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { toDbDate, todayISO } from "@/lib/dates";
import { getJourneyDashboard } from "@/lib/journey-queries";
import { getJourneyLevelGate } from "@/lib/journey-calendar";
import { syncJourneyAchievements } from "@/lib/journey-achievements";
import { JOURNEY_GOAL_DOMAINS, findGoalOption, weeklyCommitmentOptions, monthlyCommitmentLabels } from "@/lib/journey-goal-domains";
import { limitsFor } from "@/lib/plan";

const optionIds = z.array(z.string().min(1).max(60)).max(12).optional();
const commitmentsSchema = z.object({
  wakeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "INVALID_TIME"),
  goals: z
    .object(Object.fromEntries(JOURNEY_GOAL_DOMAINS.map((d) => [d.key, optionIds])) as Record<(typeof JOURNEY_GOAL_DOMAINS)[number]["key"], typeof optionIds>)
    .optional(),
});
export type JourneyCommitmentsInput = z.infer<typeof commitmentsSchema>;

export async function respondToJourneyOffer(accept: boolean, commitments?: JourneyCommitmentsInput) {
  return run(async () => {
    const user = await requireUser();
    const wantsJourney = z.boolean().parse(accept);

    if (!wantsJourney) {
      if (user.journeyOfferStatus !== "PENDING") throw new UserError("OFFER_ALREADY_HANDLED");
      await db.user.updateMany({
        where: { id: user.id, journeyOfferStatus: "PENDING" },
        data: { journeyOfferStatus: "DECLINED" },
      });
      revalidatePath("/dashboard");
      return;
    }

    // Cho phép bắt đầu lại từ trang Hành trình nếu trước đó đã bỏ qua lời mời ban đầu.
    if (user.journeyOfferStatus === "ACCEPTED") throw new UserError("OFFER_ALREADY_HANDLED");
    const parsedCommitments = commitmentsSchema.parse(commitments);

    const program = await db.journeyProgram.findFirst({
      where: { status: "PUBLISHED", ruleSets: { some: { publishedAt: { not: null } } } },
      orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
      include: {
        ruleSets: {
          where: { publishedAt: { not: null } },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    const ruleSet = program?.ruleSets[0];
    if (!program || !ruleSet) throw new UserError("JOURNEY_NOT_AVAILABLE");

    // Chỉ tin id lựa chọn gửi từ client — tra lại nhãn/nhịp độ (DAILY/WEEKLY/MONTHLY) từ danh mục chuẩn trên server.
    const resolvedGoals = Object.entries(parsedCommitments.goals ?? {}).flatMap(([domainKey, chosenIds]) =>
      (chosenIds ?? [])
        .map((id) => findGoalOption(domainKey, id))
        .filter((option): option is NonNullable<typeof option> => !!option)
        .map((option) => ({ domainKey, option })),
    );
    const dailyGoals = resolvedGoals.filter((g) => g.option.cadence === "DAILY");

    const startDate = toDbDate(todayISO(user.timezone));
    await db.$transaction(async (tx) => {
      const claimed = await tx.user.updateMany({
        where: { id: user.id, journeyOfferStatus: user.journeyOfferStatus },
        data: { journeyOfferStatus: "ACCEPTED" },
      });
      if (!claimed.count) throw new UserError("OFFER_ALREADY_HANDLED");

      const journey = await tx.userJourney.create({
        data: {
          userId: user.id,
          programId: program.id,
          ruleSetId: ruleSet.id,
          timezone: user.timezone,
          currentDay: 1,
          commitments: {
            wakeTime: parsedCommitments.wakeTime,
            goals: Object.fromEntries(
              JOURNEY_GOAL_DOMAINS.map((d) => [
                d.key,
                resolvedGoals.filter((g) => g.domainKey === d.key).map((g) => ({ optionId: g.option.id, label: g.option.label, cadence: g.option.cadence })),
              ]).filter(([, list]) => (list as unknown[]).length > 0),
            ),
            committedAt: new Date().toISOString(),
          },
        },
      });
      await tx.journeyDayRecord.create({
        data: { journeyId: journey.id, journeyDay: 1, date: startDate },
      });

      // Cam kết nhịp DAILY -> tự tạo Thói quen lặp mỗi ngày (tái dùng hệ thống Habit có sẵn thay vì
      // xây cơ chế lặp-theo-ngày riêng). Bỏ qua phần vượt hạn mức gói Free thay vì chặn cả việc tạo hành trình.
      if (dailyGoals.length) {
        const existingHabits = await tx.habit.count({ where: { userId: user.id, archivedAt: null } });
        const remainingSlots = Math.max(0, limitsFor(user).habits - existingHabits);
        const toCreate = dailyGoals.slice(0, remainingSlots);
        if (toCreate.length) {
          await tx.habit.createMany({
            data: toCreate.map((g, i) => ({
              userId: user.id,
              name: g.option.label,
              icon: "circle-check",
              color: "jade",
              daysOfWeek: [],
              targetPerDay: 1,
              sortOrder: existingHabits + i,
            })),
          });
        }
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/journey");
    revalidatePath("/habits");
  });
}

export async function completeJourneyMission(missionId: string) {
  return run(async () => {
    const user = await requireUser();
    const id = z.string().cuid().parse(missionId);
    const dashboard = await getJourneyDashboard(user);
    if (!dashboard?.level || !dashboard.dayRecord || dashboard.dayRecord.status !== "IN_PROGRESS") throw new UserError("JOURNEY_NOT_ACTIVE");

    const mission = dashboard.missions.find((item) => item.id === id) ?? dashboard.recoveryMissions.find((item) => item.id === id);
    if (!mission) throw new UserError("MISSION_NOT_AVAILABLE");
    if (mission.completions.length) return false;

    await db.$transaction(async (tx) => {
      const completion = await tx.journeyMissionCompletion.upsert({
        where: { journeyId_missionId: { journeyId: dashboard.journey.id, missionId: id } },
        update: {},
        create: { journeyId: dashboard.journey.id, dayRecordId: dashboard.dayRecord!.id, missionId: id },
      });
      await tx.journeyXPTransaction.upsert({
        where: { idempotencyKey: `mission:${completion.id}` },
        update: {},
        create: {
          userId: user.id,
          journeyId: dashboard.journey.id,
          missionCompletionId: completion.id,
          eventType: "MISSION_COMPLETED",
          xp: mission.xpReward,
          reason: mission.title,
          idempotencyKey: `mission:${completion.id}`,
        },
      });
    });

    await syncJourneyAchievements(user.id);
    revalidatePath("/journey");
    revalidatePath("/dashboard");
    return true;
  });
}

const personalMissionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(800).default(""),
  category: z.string().trim().max(60).default(""),
  suggestedMinutes: z.number().int().min(1).max(360).nullable(),
  xpReward: z.number().int().min(0).max(100),
});

export async function createJourneyPersonalMission(input: z.input<typeof personalMissionSchema>) {
  return run(async () => {
    const user = await requireUser();
    const data = personalMissionSchema.parse(input);
    const dashboard = await getJourneyDashboard(user);
    if (!dashboard?.dayRecord || dashboard.dayRecord.status !== "IN_PROGRESS") throw new UserError("JOURNEY_NOT_ACTIVE");
    await db.journeyPersonalMission.create({
      data: {
        journeyId: dashboard.journey.id,
        dayRecordId: dashboard.dayRecord.id,
        ...data,
        description: data.description || null,
        category: data.category || null,
      },
    });
    revalidatePath("/journey");
  });
}

export async function updateJourneyPersonalMission(id: string, input: z.input<typeof personalMissionSchema>) {
  return run(async () => {
    const user = await requireUser();
    const missionId = z.string().cuid().parse(id);
    const data = personalMissionSchema.parse(input);
    const journey = await db.userJourney.findFirst({ where: { userId: user.id, status: "ACTIVE" }, select: { id: true } });
    if (!journey) throw new UserError("JOURNEY_NOT_ACTIVE");
    const result = await db.journeyPersonalMission.updateMany({
      where: { id: missionId, journeyId: journey.id, completedAt: null },
      data: { ...data, description: data.description || null, category: data.category || null },
    });
    if (!result.count) throw new UserError("NOT_FOUND");
    revalidatePath("/journey");
  });
}

export async function deleteJourneyPersonalMission(id: string) {
  return run(async () => {
    const user = await requireUser();
    const missionId = z.string().cuid().parse(id);
    const journey = await db.userJourney.findFirst({ where: { userId: user.id, status: "ACTIVE" }, select: { id: true } });
    if (!journey) throw new UserError("JOURNEY_NOT_ACTIVE");
    const result = await db.journeyPersonalMission.deleteMany({ where: { id: missionId, journeyId: journey.id, completedAt: null } });
    if (!result.count) throw new UserError("NOT_FOUND");
    revalidatePath("/journey");
  });
}

export async function completeJourneyPersonalMission(id: string) {
  return run(async () => {
    const user = await requireUser();
    const missionId = z.string().cuid().parse(id);
    const journey = await db.userJourney.findFirst({ where: { userId: user.id, status: "ACTIVE" }, select: { id: true } });
    if (!journey) throw new UserError("JOURNEY_NOT_ACTIVE");
    const mission = await db.journeyPersonalMission.findFirst({ where: { id: missionId, journeyId: journey.id, completedAt: null } });
    if (!mission) throw new UserError("NOT_FOUND");

    await db.$transaction(async (tx) => {
      const completedAt = new Date();
      await tx.journeyPersonalMission.updateMany({ where: { id: mission.id, journeyId: journey.id, completedAt: null }, data: { completedAt } });
      await tx.journeyXPTransaction.upsert({
        where: { idempotencyKey: `personal-mission:${mission.id}` },
        update: {},
        create: {
          userId: user.id,
          journeyId: journey.id,
          eventType: "PERSONAL_MISSION_COMPLETED",
          xp: mission.xpReward,
          reason: mission.title,
          idempotencyKey: `personal-mission:${mission.id}`,
        },
      });
    });

    await syncJourneyAchievements(user.id);
    revalidatePath("/journey");
    return undefined;
  });
}

export async function completeJourneyDailyChallenge() {
  return run(async () => {
    const user = await requireUser();
    const dashboard = await getJourneyDashboard(user);
    if (!dashboard?.dailyChallenge || !dashboard.dayRecord || dashboard.dayRecord.status !== "IN_PROGRESS") {
      throw new UserError("CHALLENGE_NOT_AVAILABLE");
    }
    if (dashboard.dayRecord.dailyChallengeCompletedAt) return false;

    await db.$transaction(async (tx) => {
      const completedAt = new Date();
      await tx.journeyDayRecord.updateMany({
        where: { id: dashboard.dayRecord!.id, status: "IN_PROGRESS", dailyChallengeCompletedAt: null },
        data: { dailyChallengeCompletedAt: completedAt },
      });
      await tx.journeyXPTransaction.upsert({
        where: { idempotencyKey: `daily-challenge:${dashboard.dayRecord!.id}` },
        update: {},
        create: {
          userId: user.id,
          journeyId: dashboard.journey.id,
          eventType: "DAILY_CHALLENGE_COMPLETED",
          xp: dashboard.dailyChallenge!.xpReward,
          reason: dashboard.dailyChallenge!.title,
          idempotencyKey: `daily-challenge:${dashboard.dayRecord!.id}`,
        },
      });
    });

    await syncJourneyAchievements(user.id);
    revalidatePath("/journey");
    revalidatePath("/dashboard");
    return true;
  });
}

export async function completeJourneyWeeklyChallenge() {
  return run(async () => {
    const user = await requireUser();
    const dashboard = await getJourneyDashboard(user);
    const challenge = dashboard?.weeklyChallenge;
    // Thử thách tuần không gắn với trạng thái "ngày hôm nay" — chỉ cần hành trình đang hoạt động
    // và thử thách của tuần hiện tại tồn tại. Không chặn chỉ vì ngày hôm nay đã được khép lại.
    if (!dashboard || !challenge || !dashboard.dayRecord) {
      throw new UserError("CHALLENGE_NOT_AVAILABLE");
    }
    if (challenge.completions[0]?.completedAt) return false;

    // Cam kết cá nhân nhịp WEEKLY (chọn lúc bắt đầu hành trình) là bắt buộc — đã tick đủ ở thẻ
    // "Công việc cần làm" (tab Tuần) chưa, kiểm tra thẳng trên server qua JourneyCommitmentCheck,
    // không nhận mảng tick từ client nữa.
    const requiredOptionIds = weeklyCommitmentOptions(dashboard.journey.commitments).map((g) => g.optionId);
    const doneSet = new Set(dashboard.completedWeeklyOptionIds);
    if (requiredOptionIds.some((id) => !doneSet.has(id))) throw new UserError("CHALLENGE_CRITERIA_INCOMPLETE");

    await db.$transaction(async (tx) => {
      const completion = await tx.journeyWeeklyChallengeCompletion.upsert({
        where: { journeyId_challengeId: { journeyId: dashboard.journey.id, challengeId: challenge.id } },
        update: {},
        create: { journeyId: dashboard.journey.id, challengeId: challenge.id, progress: 100, completedAt: new Date(), snapshot: { selfReported: true } },
      });
      if (!completion.completedAt) {
        await tx.journeyWeeklyChallengeCompletion.update({ where: { id: completion.id }, data: { progress: 100, completedAt: new Date(), snapshot: { selfReported: true } } });
      }
      await tx.journeyXPTransaction.upsert({
        where: { idempotencyKey: `weekly-challenge:${dashboard.journey.id}:${challenge.id}` },
        update: {},
        create: {
          userId: user.id,
          journeyId: dashboard.journey.id,
          eventType: "WEEKLY_CHALLENGE_COMPLETED",
          xp: challenge.xpReward,
          reason: challenge.title,
          idempotencyKey: `weekly-challenge:${dashboard.journey.id}:${challenge.id}`,
        },
      });
    });

    await syncJourneyAchievements(user.id);
    revalidatePath("/journey");
    revalidatePath("/dashboard");
    return true;
  });
}

export async function completeJourneyMonthlyChallenge(checkedCriteria: string[]) {
  return run(async () => {
    const user = await requireUser();
    const submitted = z.array(z.string().trim().min(1).max(500)).max(30).parse(checkedCriteria);
    const dashboard = await getJourneyDashboard(user);
    const challenge = dashboard?.monthlyChallenge;
    // Thử thách tháng không gắn với trạng thái "ngày hôm nay" — xem lý do ở completeJourneyWeeklyChallenge.
    if (!dashboard || !challenge || !dashboard.dayRecord) {
      throw new UserError("CHALLENGE_NOT_AVAILABLE");
    }
    if (challenge.completions[0]?.passed) return false;

    const seededCriteria = Array.isArray(challenge.completionCriteria)
      ? challenge.completionCriteria.filter((item): item is string => typeof item === "string")
      : [];
    // Cam kết cá nhân nhịp MONTHLY (chọn lúc bắt đầu hành trình) cũng bắt buộc, cộng thêm vào tiêu chí có sẵn.
    const criteria = [...seededCriteria, ...monthlyCommitmentLabels(dashboard.journey.commitments)];
    const checked = new Set(submitted);
    if (!criteria.length || criteria.some((item) => !checked.has(item))) throw new UserError("CHALLENGE_CRITERIA_INCOMPLETE");

    await db.$transaction(async (tx) => {
      const completion = await tx.journeyMonthlyChallengeCompletion.upsert({
        where: { journeyId_challengeId: { journeyId: dashboard.journey.id, challengeId: challenge.id } },
        update: {},
        create: {
          journeyId: dashboard.journey.id,
          challengeId: challenge.id,
          passed: true,
          completedAt: new Date(),
          snapshot: { checkedCriteria: criteria },
        },
      });
      if (!completion.passed) {
        await tx.journeyMonthlyChallengeCompletion.update({ where: { id: completion.id }, data: { passed: true, completedAt: new Date(), snapshot: { checkedCriteria: criteria } } });
      }
      await tx.journeyXPTransaction.upsert({
        where: { idempotencyKey: `monthly-challenge:${dashboard.journey.id}:${challenge.id}` },
        update: {},
        create: {
          userId: user.id,
          journeyId: dashboard.journey.id,
          eventType: "MONTHLY_CHALLENGE_COMPLETED",
          xp: challenge.xpReward,
          reason: challenge.title,
          idempotencyKey: `monthly-challenge:${dashboard.journey.id}:${challenge.id}`,
        },
      });
    });

    await syncJourneyAchievements(user.id);
    revalidatePath("/journey");
    revalidatePath("/dashboard");
    return true;
  });
}

const levelReviewSchema = z.object({
  answers: z.array(z.string().trim().min(1).max(1000)).min(3).max(10),
});

export async function submitJourneyLevelReview(input: z.input<typeof levelReviewSchema>) {
  return run(async () => {
    const user = await requireUser();
    const data = levelReviewSchema.parse(input);
    const dashboard = await getJourneyDashboard(user);
    if (!dashboard?.level || !dashboard.dayRecord || dashboard.journey.currentDay !== dashboard.level.endDay) {
      throw new UserError("LEVEL_REVIEW_NOT_READY");
    }
    const completedFinalDay = await db.journeyDayRecord.findFirst({
      where: { journeyId: dashboard.journey.id, journeyDay: dashboard.level.endDay, status: "COMPLETED" },
      select: { id: true },
    });
    if (!completedFinalDay) throw new UserError("LEVEL_REVIEW_NOT_READY");

    const [totalMissions, completedMissions, monthlyChallenge, monthlyCompletion, completedTasks, onTimeTransactions] = await Promise.all([
      db.journeyMission.count({ where: { levelId: dashboard.level.id, active: true } }),
      db.journeyMissionCompletion.count({ where: { journeyId: dashboard.journey.id, mission: { levelId: dashboard.level.id, active: true } } }),
      db.journeyMonthlyChallenge.findUnique({ where: { levelId: dashboard.level.id }, select: { id: true } }),
      db.journeyMonthlyChallengeCompletion.findFirst({ where: { journeyId: dashboard.journey.id, challenge: { levelId: dashboard.level.id }, passed: true }, select: { id: true } }),
      db.disciplineTransaction.count({ where: { journeyId: dashboard.journey.id, eventType: "WORK_COMPLETED_EARLY" } }),
      db.disciplineTransaction.count({ where: { journeyId: dashboard.journey.id, eventType: "WORK_COMPLETED_ON_TIME" } }),
    ]);
    const gate = getJourneyLevelGate({
      completedMissions,
      totalMissions,
      thresholdPercent: dashboard.level.completionThreshold,
      monthlyChallengeCompleted: !monthlyChallenge || !!monthlyCompletion,
      reviewPassed: false,
    });
    if (!gate.missionsPassed || !gate.monthlyChallengePassed) throw new UserError("LEVEL_REQUIREMENTS_INCOMPLETE");

    const reportSnapshot = {
      completionRate: gate.completionRate,
      completedMissions,
      totalMissions,
      workspaceCompletedEarly: completedTasks,
      workspaceCompletedOnTime: onTimeTransactions,
      disciplinePoints: await db.disciplineTransaction.aggregate({ where: { journeyId: dashboard.journey.id }, _sum: { points: true } }).then((result) => result._sum.points ?? 0),
      generatedAt: new Date().toISOString(),
    };
    await db.$transaction(async (tx) => {
      await tx.journeyLevelReview.upsert({
        where: { journeyId_levelId: { journeyId: dashboard.journey.id, levelId: dashboard.level!.id } },
        update: { answers: data.answers, completionRate: gate.completionRate, passed: true, reportSnapshot },
        create: { journeyId: dashboard.journey.id, levelId: dashboard.level!.id, answers: data.answers, completionRate: gate.completionRate, passed: true, reportSnapshot },
      });
      await tx.journeyXPTransaction.upsert({
        where: { idempotencyKey: `level-review:${dashboard.journey.id}:${dashboard.level!.id}` },
        update: {},
        create: {
          userId: user.id,
          journeyId: dashboard.journey.id,
          eventType: "LEVEL_REVIEW_COMPLETED",
          xp: 50,
          reason: `Tổng kết Level ${dashboard.level!.number}`,
          idempotencyKey: `level-review:${dashboard.journey.id}:${dashboard.level!.id}`,
        },
      });
    });

    await syncJourneyAchievements(user.id);
    revalidatePath("/journey");
    revalidatePath("/dashboard");
    return undefined;
  });
}

const reflectionSchema = z.object({
  mood: z.number().int().min(1).max(5),
  wins: z.string().trim().max(1000).default(""),
  lesson: z.string().trim().max(1000).default(""),
  gratitude: z.string().trim().max(1000).default(""),
  improvement: z.string().trim().max(1000).default(""),
});

export async function saveJourneyReflection(input: z.input<typeof reflectionSchema>) {
  return run(async () => {
    const user = await requireUser();
    const data = reflectionSchema.parse(input);
    const dashboard = await getJourneyDashboard(user);
    if (!dashboard?.dayRecord || dashboard.dayRecord.status !== "IN_PROGRESS") throw new UserError("JOURNEY_NOT_ACTIVE");

    await db.journeyReflection.upsert({
      where: { dayRecordId: dashboard.dayRecord.id },
      update: data,
      create: { dayRecordId: dashboard.dayRecord.id, ...data },
    });

    revalidatePath("/journey");
    return undefined;
  });
}

const expenseSchema = z.object({
  amountVnd: z.coerce.number().int().min(0).max(1_000_000_000),
  note: z.string().trim().max(200).optional(),
});

/** Ghi nhận chi tiêu hôm nay — tối giản (chỉ số tiền + ghi chú), dùng trong thử thách ngày.
 * Phần quản lý chi tiêu đầy đủ (phân loại, ngân sách, báo cáo) sẽ xây sau, dựa trên bảng JourneyExpenseEntry này. */
export async function saveJourneyExpense(input: z.input<typeof expenseSchema>) {
  return run(async () => {
    const user = await requireUser();
    const data = expenseSchema.parse(input);
    const dashboard = await getJourneyDashboard(user);
    if (!dashboard?.dayRecord) throw new UserError("JOURNEY_NOT_ACTIVE");

    await db.journeyExpenseEntry.upsert({
      where: { dayRecordId: dashboard.dayRecord.id },
      update: { amountVnd: data.amountVnd, note: data.note },
      create: {
        journeyId: dashboard.journey.id,
        dayRecordId: dashboard.dayRecord.id,
        date: dashboard.dayRecord.date,
        amountVnd: data.amountVnd,
        note: data.note,
      },
    });

    revalidatePath("/journey");
    return undefined;
  });
}

/** Tick/bỏ tick một cam kết cá nhân nhịp WEEKLY cho tuần hiện tại — hiển thị ở thẻ "Công việc cần làm"
 * (tab Tuần). Weekly Challenge chỉ cho xác nhận khi tất cả cam kết tuần đã được tick ở đây. */
export async function toggleJourneyWeeklyCommitment(optionId: string) {
  return run(async () => {
    const user = await requireUser();
    const id = z.string().min(1).max(60).parse(optionId);
    const dashboard = await getJourneyDashboard(user);
    if (!dashboard?.level) throw new UserError("JOURNEY_NOT_ACTIVE");

    const option = weeklyCommitmentOptions(dashboard.journey.commitments).find((g) => g.optionId === id);
    if (!option) throw new UserError("VALIDATION");

    const existing = await db.journeyCommitmentCheck.findUnique({
      where: { journeyId_weekNumber_optionId: { journeyId: dashboard.journey.id, weekNumber: dashboard.weekNumber, optionId: id } },
    });
    if (existing) {
      await db.journeyCommitmentCheck.delete({ where: { id: existing.id } });
    } else {
      await db.journeyCommitmentCheck.create({
        data: { journeyId: dashboard.journey.id, weekNumber: dashboard.weekNumber, optionId: id, label: option.label },
      });
    }

    revalidatePath("/journey");
    return !existing;
  });
}

export async function completeJourneyDay() {
  return run(async () => {
    const user = await requireUser();
    const dashboard = await getJourneyDashboard(user);
    if (!dashboard?.dayRecord || dashboard.dayRecord.status !== "IN_PROGRESS") throw new UserError("JOURNEY_NOT_ACTIVE");
    if (!dashboard.dayRecord.reflection) throw new UserError("REFLECTION_REQUIRED");

    const completedMissions = dashboard.journey.currentDay === dashboard.level?.endDay && dashboard.level
      ? await db.journeyMissionCompletion.count({ where: { journeyId: dashboard.journey.id, mission: { levelId: dashboard.level.id, active: true } } })
      : await db.journeyMissionCompletion.count({ where: { journeyId: dashboard.journey.id, dayRecordId: dashboard.dayRecord.id } });
    if (completedMissions === 0) throw new UserError("MISSION_REQUIRED");

    const today = toDbDate(todayISO(dashboard.journey.timezone));
    const result = await db.journeyDayRecord.updateMany({
      where: { id: dashboard.dayRecord.id, date: today, status: "IN_PROGRESS" },
      data: { status: "COMPLETED", dailyScore: dashboard.dailyScore, completedAt: new Date() },
    });
    if (!result.count) throw new UserError("JOURNEY_DAY_ALREADY_CLOSED");

    await syncJourneyAchievements(user.id);
    revalidatePath("/journey");
    revalidatePath("/dashboard");
    return undefined;
  });
}

export async function setJourneyRestDay(reason = "") {
  return run(async () => {
    const user = await requireUser();
    const restReason = z.string().trim().max(300).parse(reason);
    const dashboard = await getJourneyDashboard(user);
    if (!dashboard?.dayRecord || dashboard.dayRecord.status !== "IN_PROGRESS") throw new UserError("JOURNEY_NOT_ACTIVE");

    const completedMissions = await db.journeyMissionCompletion.count({ where: { journeyId: dashboard.journey.id, dayRecordId: dashboard.dayRecord.id } });
    if (completedMissions) throw new UserError("REST_AFTER_PROGRESS");

    const result = await db.journeyDayRecord.updateMany({
      where: { id: dashboard.dayRecord.id, status: "IN_PROGRESS" },
      data: { status: "REST", restReason: restReason || null, completedAt: new Date() },
    });
    if (!result.count) throw new UserError("JOURNEY_DAY_ALREADY_CLOSED");

    revalidatePath("/journey");
    revalidatePath("/dashboard");
    return undefined;
  });
}