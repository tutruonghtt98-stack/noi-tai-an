import { fmt } from "@/lib/i18n/format";
import type { Dict } from "@/lib/i18n/vi";

type Period = { horizon: "YEAR" | "QUARTER" | "MONTH"; year: number; quarter: number | null; month: number | null };

/** "2026" · "Q4 · 2026" · "Tháng 10/2026" */
export function periodLabel(g: Period, t: Dict) {
  if (g.horizon === "YEAR") return String(g.year);
  if (g.horizon === "QUARTER") return fmt(t.goals.quarterLabel, { q: g.quarter ?? 1, y: g.year });
  return `${t.goals.fields.month} ${g.month}/${g.year}`;
}
