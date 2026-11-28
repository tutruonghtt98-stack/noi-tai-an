// Tính toán thuần (không import DB) cho module tài chính.
import { addDays, addMonths, isoInZone, monthBounds, startOfWeek, type ISODate } from "./dates";

export type BudgetWarningLevel = "NONE" | "WARN_80" | "WARN_90" | "OVER_100";

/** Mức cảnh báo ngân sách. limitVnd <= 0 nghĩa là chưa đặt ngân sách → NONE.
 * So sánh bằng phép nhân số nguyên để tránh sai số dấu phẩy động ở ngưỡng 80/90%. */
export function budgetWarningLevel(spentVnd: number, limitVnd: number): BudgetWarningLevel {
  if (limitVnd <= 0) return "NONE";
  if (spentVnd >= limitVnd) return "OVER_100";
  if (spentVnd * 10 >= limitVnd * 9) return "WARN_90";
  if (spentVnd * 10 >= limitVnd * 8) return "WARN_80";
  return "NONE";
}

/** Ngày chạy kế tiếp của quy tắc định kỳ, tính từ ngày `from`. */
export function nextRunDateFor(cycle: "WEEKLY" | "MONTHLY", from: ISODate): ISODate {
  return cycle === "WEEKLY" ? addDays(from, 7) : addMonths(from, 1);
}

type FinanceTxLike = { type: "INCOME" | "EXPENSE"; amountVnd: number; occurredAt: string; savingsGoalId: string | null };

/** `count` nhãn "YYYY-MM" kết thúc ở tháng của `today`, cũ → mới. */
function lastMonthLabels(today: ISODate, count: number): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y!, m! - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** Xu hướng thu/chi theo ngày (30 ô), tuần (12 ô) hoặc tháng (12 ô), cũ → mới.
 * Giao dịch ngoài khoảng các ô thì bị bỏ, không gộp vào ô gần nhất. */
export function computeIncomeExpenseTrend(
  transactions: FinanceTxLike[],
  timezone: string,
  unit: "day" | "week" | "month",
  weekStartsOn: number,
  today: ISODate = isoInZone(new Date(), timezone),
): { label: string; incomeVnd: number; expenseVnd: number }[] {
  let labels: string[];
  if (unit === "day") {
    labels = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  } else if (unit === "week") {
    const thisWeek = startOfWeek(today, weekStartsOn);
    labels = Array.from({ length: 12 }, (_, i) => addDays(thisWeek, (i - 11) * 7));
  } else {
    labels = lastMonthLabels(today, 12);
  }

  const buckets = new Map(labels.map((label) => [label, { label, incomeVnd: 0, expenseVnd: 0 }]));
  for (const t of transactions) {
    const date = t.occurredAt.slice(0, 10);
    const key = unit === "day" ? date : unit === "week" ? startOfWeek(date, weekStartsOn) : date.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (t.type === "INCOME") bucket.incomeVnd += t.amountVnd;
    else bucket.expenseVnd += t.amountVnd;
  }
  return labels.map((label) => buckets.get(label)!);
}

/** Các giao dịch rơi vào đúng ngày `date` (YYYY-MM-DD). */
export function getTransactionsForDate<T extends { occurredAt: string }>(transactions: T[], timezone: string, date: ISODate): T[] {
  return transactions.filter((t) => t.occurredAt.slice(0, 10) === date);
}

/** Tổng thu/chi theo từng ngày trong tháng. Ngày không có giao dịch thì không có khóa (không ghi 0). */
export function getMonthCalendarSummary(
  transactions: { type: "INCOME" | "EXPENSE"; amountVnd: number; occurredAt: string }[],
  timezone: string,
  year: number,
  month: number,
): Record<ISODate, { incomeVnd: number; expenseVnd: number }> {
  const { from, to } = monthBounds(year, month);
  const summary: Record<ISODate, { incomeVnd: number; expenseVnd: number }> = {};
  for (const t of transactions) {
    const date = t.occurredAt.slice(0, 10);
    if (date < from || date > to) continue;
    const day = (summary[date] ??= { incomeVnd: 0, expenseVnd: 0 });
    if (t.type === "INCOME") day.incomeVnd += t.amountVnd;
    else day.expenseVnd += t.amountVnd;
  }
  return summary;
}

/** Tỷ lệ tiết kiệm theo tháng (6 tháng, cũ → mới). Mẫu số là thu nhập thật (không tính rút từ mục tiêu tiết kiệm);
 * tử số là tiền gửi − tiền rút vào/ra mục tiêu. Tháng không có thu nhập thật → 0%. */
export function computeSavingsRateTrend(
  transactions: FinanceTxLike[],
  timezone: string,
  today: ISODate = isoInZone(new Date(), timezone),
): { label: string; ratePercent: number }[] {
  const labels = lastMonthLabels(today, 6);
  const sums = new Map(labels.map((label) => [label, { realIncomeVnd: 0, netSavingsVnd: 0 }]));
  for (const t of transactions) {
    const sum = sums.get(t.occurredAt.slice(0, 7));
    if (!sum) continue;
    if (t.savingsGoalId === null) {
      if (t.type === "INCOME") sum.realIncomeVnd += t.amountVnd;
    } else {
      if (t.type === "EXPENSE") sum.netSavingsVnd += t.amountVnd;
      else sum.netSavingsVnd -= t.amountVnd;
    }
  }
  return labels.map((label) => {
    const { realIncomeVnd, netSavingsVnd } = sums.get(label)!;
    return {
      label,
      // `|| 0` đổi -0 (làm tròn số âm nhỏ) thành 0
      ratePercent: realIncomeVnd === 0 ? 0 : Math.round((netSavingsVnd / realIncomeVnd) * 100) || 0,
    };
  });
}
