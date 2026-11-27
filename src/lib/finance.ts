// Tính toán thuần (không import DB) cho module tài chính.
import { addDays, addMonths, type ISODate } from "./dates";

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
