import type { Metadata } from "next";
import Link from "next/link";
import { Target } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { getGoalOptions, getGoals, type GoalView } from "@/lib/queries";
import { GoalCard, NewGoalButton } from "@/components/goals";
import { periodLabel } from "@/lib/goal-format";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/ui/empty";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Mục tiêu" };

type H = "YEAR" | "QUARTER" | "MONTH";
const HORIZONS: H[] = ["YEAR", "QUARTER", "MONTH"];

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ h?: string; y?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const sp = await searchParams;
  const currentYear = Number(todayISO(user.timezone).slice(0, 4));
  const year = Number(sp.y) || currentYear;
  const horizon = HORIZONS.includes(sp.h as H) ? (sp.h as H) : undefined;

  const [goals, options] = await Promise.all([getGoals(user, { year, horizon }), getGoalOptions(user)]);

  // Nhóm theo kỳ: Năm → từng Quý → từng Tháng
  const groups = new Map<string, GoalView[]>();
  for (const g of goals) {
    const key = `${g.horizon}:${g.quarter ?? 0}:${g.month ?? 0}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  const href = (h?: H, y = year) => `/goals?${new URLSearchParams({ ...(h ? { h } : {}), y: String(y) })}`;

  return (
    <>
      <PageHeader title={t.goals.title} subtitle={t.goals.subtitle} action={<NewGoalButton options={options} defaults={{ horizon: horizon ?? "YEAR", year }} />} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="segmented bg-surface shadow-card" aria-label={t.goals.fields.horizon}>
          <Link href={href()} aria-current={!horizon ? "page" : undefined}>
            {t.goals.all}
          </Link>
          {HORIZONS.map((h) => (
            <Link key={h} href={href(h)} aria-current={horizon === h ? "page" : undefined}>
              {t.goals.horizon[h]}
            </Link>
          ))}
        </nav>
        <nav className="segmented bg-surface shadow-card" aria-label={t.goals.fields.year}>
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <Link key={y} href={href(horizon, y)} aria-current={year === y ? "page" : undefined} className="tabular">
              {y}
            </Link>
          ))}
        </nav>
      </div>

      {goals.length === 0 ? (
        <div className="card">
          <Empty icon={Target} text={t.goals.empty}>
            <NewGoalButton options={options} defaults={{ horizon: horizon ?? "YEAR", year }} label={t.goals.emptyCta} />
          </Empty>
        </div>
      ) : (
        <div className="space-y-10">
          {[...groups.entries()].map(([key, list]) => (
            <section key={key} aria-label={periodLabel(list[0]!, t)}>
              <h2 className="mb-4 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                {t.goals.horizon[list[0]!.horizon]} · {periodLabel(list[0]!, t)}
                <span className="h-px flex-1 bg-line" aria-hidden />
              </h2>
              <div className="grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2 xl:grid-cols-3">
                {list.map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
