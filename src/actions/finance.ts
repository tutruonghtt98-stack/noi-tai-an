"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { toDbDate, isValidISO, monthBounds, isoInZone, fromDbDate } from "@/lib/dates";
import { budgetWarningLevel, nextRunDateFor, type BudgetWarningLevel } from "@/lib/finance";

const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amountVnd: z.coerce.number().int().min(1).max(1_000_000_000),
  category: z.string().trim().min(1).max(60).optional(),
  accountName: z.string().trim().max(60).optional(),
  note: z.string().trim().max(200).optional(),
  occurredAt: z.string().refine(isValidISO, "VALIDATION"),
});

const recurringRuleSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amountVnd: z.coerce.number().int().min(1).max(1_000_000_000),
  category: z.string().trim().min(1).max(60).optional(),
  accountName: z.string().trim().max(60).optional(),
  note: z.string().trim().max(200).optional(),
  cycle: z.enum(["WEEKLY", "MONTHLY"]),
  startDate: z.string().refine(isValidISO, "VALIDATION"),
});

const budgetSchema = z.object({
  category: z.string().trim().min(1).max(60),
  monthlyLimitVnd: z.coerce.number().int().min(0).max(1_000_000_000),
});

export async function createFinanceTransaction(input: z.input<typeof transactionSchema>) {
  return run(async () => {
    const user = await requireUser();
    const data = transactionSchema.parse(input);

    if (data.type === "EXPENSE" && !data.category) throw new UserError("CATEGORY_REQUIRED");

    const normalizedCategory = data.category ? data.category.replace(/\s+/g, " ") : undefined;

    await db.financeTransaction.create({
      data: {
        userId: user.id,
        type: data.type,
        amountVnd: data.amountVnd,
        category: normalizedCategory,
        accountName: data.accountName,
        note: data.note,
        occurredAt: toDbDate(data.occurredAt),
      },
    });

    if (data.type === "INCOME") {
      revalidatePath("/finance");
      return { warning: "NONE" as const };
    }

    const year = Number(data.occurredAt.slice(0, 4));
    const month = Number(data.occurredAt.slice(5, 7));
    const { from, to } = monthBounds(year, month);

    const [aggregate, budget] = await Promise.all([
      db.financeTransaction.aggregate({
        where: {
          userId: user.id,
          type: "EXPENSE",
          category: { equals: normalizedCategory, mode: "insensitive" },
          occurredAt: { gte: toDbDate(from), lte: toDbDate(to) },
        },
        _sum: { amountVnd: true },
      }),
      db.financeBudget.findFirst({
        where: { userId: user.id, category: { equals: normalizedCategory, mode: "insensitive" } },
      }),
    ]);

    const warning: BudgetWarningLevel = budgetWarningLevel(aggregate._sum.amountVnd ?? 0, budget?.monthlyLimitVnd ?? 0);

    revalidatePath("/finance");
    return { warning };
  });
}

export async function upsertFinanceBudget(input: z.input<typeof budgetSchema>) {
  return run(async () => {
    const user = await requireUser();
    const data = budgetSchema.parse(input);
    const normalizedCategory = data.category.replace(/\s+/g, " ");

    const existing = await db.financeBudget.findFirst({
      where: { userId: user.id, category: { equals: normalizedCategory, mode: "insensitive" } },
    });
    if (existing) {
      await db.financeBudget.update({ where: { id: existing.id }, data: { monthlyLimitVnd: data.monthlyLimitVnd } });
    } else {
      await db.financeBudget.create({
        data: { userId: user.id, category: normalizedCategory, monthlyLimitVnd: data.monthlyLimitVnd },
      });
    }

    revalidatePath("/finance");
  });
}

export async function createFinanceRecurringRule(input: z.input<typeof recurringRuleSchema>) {
  return run(async () => {
    const user = await requireUser();
    const data = recurringRuleSchema.parse(input);

    if (data.type === "EXPENSE" && !data.category) throw new UserError("CATEGORY_REQUIRED");

    const normalizedCategory = data.category ? data.category.replace(/\s+/g, " ") : undefined;

    await db.financeRecurringRule.create({
      data: {
        userId: user.id,
        type: data.type,
        amountVnd: data.amountVnd,
        category: normalizedCategory,
        accountName: data.accountName,
        note: data.note,
        cycle: data.cycle,
        startDate: toDbDate(data.startDate),
        nextRunDate: toDbDate(data.startDate),
      },
    });

    revalidatePath("/finance");
  });
}

export async function toggleFinanceRecurringRule(id: string) {
  return run(async () => {
    const user = await requireUser();
    const ruleId = z.string().min(1).parse(id);

    const rule = await db.financeRecurringRule.findFirst({
      where: { id: ruleId, userId: user.id },
    });
    if (!rule) {
      revalidatePath("/finance");
      return;
    }

    const nowActive = !rule.active;
    let nextRunDate = rule.nextRunDate;

    if (nowActive) {
      const today = isoInZone(new Date(), user.timezone);
      let nextRunIso = fromDbDate(rule.nextRunDate);
      while (nextRunIso <= today) {
        nextRunIso = nextRunDateFor(rule.cycle, nextRunIso);
      }
      nextRunDate = toDbDate(nextRunIso);
    }

    await db.financeRecurringRule.updateMany({
      where: { id: ruleId, userId: user.id },
      data: { active: nowActive, nextRunDate },
    });

    revalidatePath("/finance");
  });
}

export async function deleteFinanceRecurringRule(id: string) {
  return run(async () => {
    const user = await requireUser();
    const ruleId = z.string().min(1).parse(id);

    await db.financeRecurringRule.deleteMany({ where: { id: ruleId, userId: user.id } });

    revalidatePath("/finance");
  });
}

export async function deleteFinanceTransaction(id: string) {
  return run(async () => {
    const user = await requireUser();
    const transactionId = z.string().min(1).parse(id);

    await db.financeTransaction.deleteMany({ where: { id: transactionId, userId: user.id } });

    revalidatePath("/finance");
  });
}
