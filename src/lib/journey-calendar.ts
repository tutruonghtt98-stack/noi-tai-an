import { addDays, type ISODate } from "@/lib/dates";

export type JourneyCalendarStatus = "IN_PROGRESS" | "COMPLETED" | "REST" | "MISSED";

export type JourneyCalendarTransition = {
  currentDay: number;
  journeyCompleted: boolean;
  missedDates: { date: ISODate; journeyDay: number }[];
};

/** Số thứ tự tuần trong toàn chương trình (1..24, 4 tuần/level) ứng với ngày hiện tại. */
export function getJourneyWeekNumber(levelNumber: number, levelStartDay: number, dayNumber: number): number {
  const dayInLevel = dayNumber - levelStartDay + 1;
  return (levelNumber - 1) * 4 + Math.min(Math.floor((dayInLevel - 1) / 7) + 1, 4);
}

export function getJourneyLevelGate(input: {
  completedMissions: number;
  totalMissions: number;
  thresholdPercent: number;
  monthlyChallengeCompleted: boolean;
  reviewPassed: boolean;
}) {
  const completionRate = input.totalMissions > 0
    ? Math.round((Math.min(input.completedMissions, input.totalMissions) / input.totalMissions) * 100)
    : 0;
  const missionsPassed = completionRate >= input.thresholdPercent;
  return {
    completionRate,
    missionsPassed,
    monthlyChallengePassed: input.monthlyChallengeCompleted,
    reviewPassed: input.reviewPassed,
    canAdvance: missionsPassed && input.monthlyChallengeCompleted && input.reviewPassed,
  };
}

export function getJourneyCalendarTransition(input: {
  today: ISODate;
  currentDay: number;
  lastRecord: { date: ISODate; journeyDay: number; status: JourneyCalendarStatus } | null;
  durationDays?: number;
}): JourneyCalendarTransition {
  const durationDays = input.durationDays ?? 180;
  let currentDay = input.currentDay;
  const missedDates: JourneyCalendarTransition["missedDates"] = [];

  if (input.lastRecord && input.lastRecord.date < input.today) {
    if (input.lastRecord.status === "COMPLETED" || input.lastRecord.status === "REST") {
      currentDay = Math.max(currentDay, input.lastRecord.journeyDay + 1);
    } else if (input.lastRecord.status === "IN_PROGRESS") {
      missedDates.push({ date: input.lastRecord.date, journeyDay: input.lastRecord.journeyDay });
    }

    for (let date = addDays(input.lastRecord.date, 1); date < input.today; date = addDays(date, 1)) {
      missedDates.push({ date, journeyDay: currentDay });
    }
  }

  return {
    currentDay,
    journeyCompleted: currentDay > durationDays,
    missedDates,
  };
}