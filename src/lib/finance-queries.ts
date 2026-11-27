import "server-only";
import { db } from "@/lib/db";
import { fromDbDate, isoInZone, monthBounds, toDbDate, type ISODate } from "@/lib/dates";
import { budgetWarningLevel, nextRunDateFor, type BudgetWarningLevel } from "@/lib/finance";

export type FinanceDashboard = {
  incomeThisMonth: number;
  expenseThisMonth: number;
  budgets: { category: string; limitVnd: number; spentVnd: number; level: BudgetWarningLevel }[];
  recentTransactions: {
    id: string;
    type: "INCOME" | "EXPENSE";
    amountVnd: number;
    category: string | null;
    accountName: string | null;
    note: string | null;
    occurredAt: string;
    recurringRuleId: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  recurringRules: {
    id: string;
    type: "INCOME" | "EXPENSE";
    amountVnd: number;
    category: string | null;
    accountName: string | null;
    note: string | null;
    cycle: "WEEKLY" | "MONTHLY";
    startDate: string;
    nextRunDate: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }[];
};

/** Lazy catch-up cho các quy tắc định kỳ đã quá hạn, chạy lúc đọc dashboard (không có cron riêng). */
export async function runDueRecurringRules(userId: string, timezone: string, throughAt = new Date()): Promise<number> {
  const today = isoInZone(throughAt, timezone);

  const dueRules = await db.financeRecurringRule.findMany({
    where: { userId, active: true, nextRunDate: { lte: toDbDate(today) } },
  });
  if (dueRules.length === 0) return 0;

  let totalCreated = 0;

  for (const rule of dueRules) {
    let nextRunIso: ISODate = fromDbDate(rule.nextRunDate);

    while (nextRunIso <= today) {
      await db.financeTransaction.create({
        data: {
          userId,
          type: rule.type,
          amountVnd: rule.amountVnd,
          category: rule.category,
          accountName: rule.accountName,
          note: rule.note,
          occurredAt: toDbDate(nextRunIso),
          recurringRuleId: rule.id,
        },
      });
      totalCreated += 1;

      if (rule.type === "EXPENSE" && rule.category) {
        const budget = await db.financeBudget.findUnique({
          where: { userId_category: { userId, category: rule.category } },
        });
        if (budget) {
          const [year, month] = nextRunIso.split("-").map(Number) as [number, number];
          const { from, to } = monthBounds(year, month);
          const spent = await db.financeTransaction.aggregate({
            where: {
              userId,
              type: "EXPENSE",
              category: rule.category,
              occurredAt: { gte: toDbDate(from), lte: toDbDate(to) },
            },
            _sum: { amountVnd: true },
          });
          const spentVnd = spent._sum.amountVnd ?? 0;
          const level = budgetWarningLevel(spentVnd, budget.monthlyLimitVnd);
          if (level !== "NONE") {
            await db.notification.create({
              data: {
                userId,
                actorId: null,
                type: "FINANCE_BUDGET_WARNING",
                title: `Chi phí cố định vừa cập nhật ngân sách "${rule.category}"`,
                body:
                  level === "OVER_100"
                    ? `Đã vượt quá hạn mức tháng này.`
                    : `Đã dùng ${level === "WARN_90" ? "90" : "80"}% hạn mức tháng này.`,
                href: "/finance",
              },
            });
          }
        }
      }

      nextRunIso = nextRunDateFor(rule.cycle, nextRunIso);
    }

    await db.financeRecurringRule.update({
      where: { id: rule.id },
      data: { nextRunDate: toDbDate(nextRunIso) },
    });
  }

  return totalCreated;
}

export async function getFinanceDashboard(userId: string, timezone: string): Promise<FinanceDashboard> {
  const today = isoInZone(new Date(), timezone);
  const [year, month] = today.split("-").map(Number) as [number, number];
  const { from, to } = monthBounds(year, month);

  const totalsByType = await db.financeTransaction.groupBy({
    by: ["type"],
    where: { userId, occurredAt: { gte: toDbDate(from), lte: toDbDate(to) } },
    _sum: { amountVnd: true },
  });
  const incomeThisMonth = totalsByType.find((t) => t.type === "INCOME")?._sum.amountVnd ?? 0;
  const expenseThisMonth = totalsByType.find((t) => t.type === "EXPENSE")?._sum.amountVnd ?? 0;

  const budgetRows = await db.financeBudget.findMany({ where: { userId } });
  const budgets = await Promise.all(
    budgetRows.map(async (b) => {
      const spent = await db.financeTransaction.aggregate({
        where: {
          userId,
          type: "EXPENSE",
          category: b.category,
          occurredAt: { gte: toDbDate(from), lte: toDbDate(to) },
        },
        _sum: { amountVnd: true },
      });
      const spentVnd = spent._sum.amountVnd ?? 0;
      return {
        category: b.category,
        limitVnd: b.monthlyLimitVnd,
        spentVnd,
        level: budgetWarningLevel(spentVnd, b.monthlyLimitVnd),
      };
    }),
  );

  const recentTransactions = await db.financeTransaction.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: 20,
  });

  const recurringRules = await db.financeRecurringRule.findMany({
    where: { userId },
    orderBy: [{ active: "desc" }, { nextRunDate: "asc" }],
  });

  return {
    incomeThisMonth,
    expenseThisMonth,
    budgets,
    recentTransactions: recentTransactions.map((t) => ({
      id: t.id,
      type: t.type,
      amountVnd: t.amountVnd,
      category: t.category,
      accountName: t.accountName,
      note: t.note,
      occurredAt: t.occurredAt.toISOString(),
      recurringRuleId: t.recurringRuleId,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    recurringRules: recurringRules.map((r) => ({
      id: r.id,
      type: r.type,
      amountVnd: r.amountVnd,
      category: r.category,
      accountName: r.accountName,
      note: r.note,
      cycle: r.cycle,
      startDate: r.startDate.toISOString(),
      nextRunDate: r.nextRunDate.toISOString(),
      active: r.active,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

export async function getTodayVariableExpenses(
  userId: string,
  timezone: string,
): Promise<{ totalVnd: number; entries: { id: string; amountVnd: number; note: string | null }[] }> {
  const today = isoInZone(new Date(), timezone);

  const entries = await db.financeTransaction.findMany({
    where: { userId, type: "EXPENSE", recurringRuleId: null, occurredAt: toDbDate(today) },
    orderBy: { createdAt: "desc" },
    select: { id: true, amountVnd: true, note: true },
  });

  const totalVnd = entries.reduce((sum, e) => sum + e.amountVnd, 0);
  return { totalVnd, entries };
}
