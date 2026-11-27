import { addDays, daysBetween, fromDbDate, type ISODate } from "@/lib/dates";

export const DURATIONS = [7, 21, 30] as const;
/** Hoàn thành khi check-in ≥ 80% số ngày. */
export const completionTarget = (days: number) => Math.ceil(days * 0.8);

export function challengeWindow(c: { startDate: Date; durationDays: number }, today: ISODate) {
  const start = fromDbDate(c.startDate);
  const end = addDays(start, c.durationDays - 1);
  const state: "upcoming" | "active" | "ended" = today < start ? "upcoming" : today > end ? "ended" : "active";
  const dayIndex = state === "upcoming" ? 0 : state === "ended" ? c.durationDays : daysBetween(start, today) + 1;
  return { start, end, state, dayIndex };
}
