import { fmt } from "@/lib/i18n/format";
import type { Dict } from "@/lib/i18n/vi";

type Period = { horizon: "YEAR" | "QUARTER" | "MONTH" | "WEEK"; year: number; quarter: number | null; month: number | null; weekStart?: Date | string | null };

/** "2026" · "Q4 · 2026" · "Tháng 10/2026" */
export function periodLabel(g: Period, t: Dict) {
  if (g.horizon === "YEAR") return String(g.year);
  if (g.horizon === "QUARTER") return fmt(t.goals.quarterLabel, { q: g.quarter ?? 1, y: g.year });
  if (g.horizon === "WEEK") {
    const ws = g.weekStart instanceof Date ? g.weekStart.toISOString().slice(0, 10) : g.weekStart;
    if (!ws) return t.goals.horizon.WEEK;
    const end = new Date(`${ws}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    const dm = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
    return `${dm(ws)} – ${dm(end.toISOString().slice(0, 10))}`;
  }
  return `${t.goals.fields.month} ${g.month}/${g.year}`;
}
