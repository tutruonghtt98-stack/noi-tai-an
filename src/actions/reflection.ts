"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncBadges } from "@/lib/badges";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { addDays, isValidISO, toDbDate, todayISO } from "@/lib/dates";
import { CAUSES } from "@/lib/reflection";


const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);

const journalSchema = z.object({
  mood: z.number().int().min(1).max(5).nullable().optional(),
  wins: text(2000),
  lessons: text(2000),
  gratitude: text(600),
  tomorrow: text(600),
  procrastination: z.array(z.enum(CAUSES)).max(CAUSES.length).default([]),
  procrastinationNote: text(1000),
});
export type JournalInput = z.input<typeof journalSchema>;

export async function saveJournal(date: string, input: JournalInput) {
  return run(async () => {
    const user = await requireUser();
    if (!isValidISO(date)) throw new UserError("VALIDATION");
    const today = todayISO(user.timezone);
    // Cho phép viết bù tối đa 7 ngày, không viết trước tương lai
    if (date > today || date < addDays(today, -7)) throw new UserError("DATE_LOCKED");
    const data = journalSchema.parse(input);
    const d = toDbDate(date);
    await db.journalEntry.upsert({
      where: { userId_date: { userId: user.id, date: d } },
      update: data,
      create: { ...data, userId: user.id, date: d },
    });
    after(() => syncBadges(user.id));
    revalidatePath("/reflection");
  });
}

const weeklySchema = z.object({
  rating: z.number().int().min(1).max(10).nullable().optional(),
  highlights: text(3000),
  obstacles: text(3000),
  rootCause: text(2000),
  experiment: text(1000),
  nextFocus: text(1000),
});
export type WeeklyInput = z.input<typeof weeklySchema>;

export async function saveWeeklyReview(weekStart: string, input: WeeklyInput) {
  return run(async () => {
    const user = await requireUser();
    if (!isValidISO(weekStart)) throw new UserError("VALIDATION");
    const data = weeklySchema.parse(input);
    const d = toDbDate(weekStart);
    await db.weeklyReview.upsert({
      where: { userId_weekStart: { userId: user.id, weekStart: d } },
      update: data,
      create: { ...data, userId: user.id, weekStart: d },
    });
    revalidatePath("/reflection");
  });
}
