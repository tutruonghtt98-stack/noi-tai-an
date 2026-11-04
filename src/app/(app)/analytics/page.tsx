import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { getWorkCompletionReport, type CompletionBucket } from "@/lib/work-queries";
import { PageHeader } from "@/components/page-header";
import { CountUp } from "@/components/ui/count-up";
import { SegmentLinks } from "@/components/ui/segment-links";
import { ColumnChart, BarList } from "@/components/charts";
import { StaggerReveal } from "@/components/ui/stagger-reveal";

export const metadata: Metadata = { title: "Phân tích" };

const PERIODS = [7, 30, 90, 365] as const;
type Period = (typeof PERIODS)[number];

const BUCKET_DOT: Record<CompletionBucket, string> = { early: "bg-jade", onTime: "bg-success", late: "bg-danger", noDeadline: "bg-muted" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.analytics;
  const sp = await searchParams;
  const period: Period = PERIODS.includes(Number(sp.period) as Period) ? (Number(sp.period) as Period) : 30;

  const report = await getWorkCompletionReport(user.id, { days: period });

  const href = (p: Period) => (p === 30 ? "/analytics" : `/analytics?period=${p}`);
  const periodLabel: Record<Period, string> = { 7: w.period7, 30: w.period30, 90: w.period90, 365: w.period365 };
  const bucketLabel: Record<CompletionBucket, string> = { early: w.bucketEarly, onTime: w.bucketOnTime, late: w.bucketLate, noDeadline: w.bucketNoDeadline };

  const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : w.noDue);
  const fmtDateTime = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

  return (
    <>
      <PageHeader title={w.title} subtitle={w.subtitle} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SegmentLinks ariaLabel={w.title} active={String(period)} items={PERIODS.map((p) => ({ value: String(p), href: href(p), label: periodLabel[p] }))} />
        <span className="badge inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-ochre" aria-hidden />
          <CountUp value={report.openCount} /> {w.liveNow}
        </span>
      </div>

      <StaggerReveal slide={{ direction: "up", offset: 20 }} holdDelay={100}>
        <section className="card grid grid-cols-2 gap-3 p-3 sm:p-4 lg:grid-cols-4" aria-label={w.title}>
          <StaggerReveal slide={{ direction: "up", offset: 16 }} holdDelay={70}>
            <div className="rounded-[1.5rem] bg-ink p-5 text-bg">
              <p className="text-sm font-medium opacity-70">{w.statCompleted}</p>
              <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
                <CountUp value={report.total} />
              </p>
              <p className="mt-3 text-sm opacity-70">{fmt(w.statCompletedNote, { n: report.total })}</p>
            </div>
            <div className="rounded-[1.5rem] bg-surface-2 p-5">
              <p className="text-sm font-medium text-ink-2">{w.statEarly}</p>
              <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
                <CountUp value={report.buckets.early} />
              </p>
              <p className="mt-3 text-sm text-muted">{w.statEarly}</p>
            </div>
            <div className="rounded-[1.5rem] bg-surface-2 p-5">
              <p className="text-sm font-medium text-ink-2">{w.statOnTime}</p>
              <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
                <CountUp value={report.buckets.onTime} />
              </p>
              <p className="mt-3 text-sm text-muted">{w.statOnTime}</p>
            </div>
            <div className="rounded-[1.5rem] bg-surface-2 p-5">
              <p className="text-sm font-medium text-ink-2">{w.statLate}</p>
              <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
                <CountUp value={report.buckets.late} />
              </p>
              <p className="mt-3 text-sm text-muted">{w.statLate}</p>
            </div>
          </StaggerReveal>
        </section>

        <div className="mt-[var(--gap)] grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-3">
          <section className="card lg:col-span-2" aria-label={w.completionsOverTime}>
            <h2 className="card-title mb-5">{w.completionsOverTime}</h2>
            <ColumnChart points={report.dailyCompletions} color="var(--ink)" suffix={` ${w.completionsUnit}`} height={220} />
          </section>

          <section className="card" aria-label={w.onTimeRate}>
            <h2 className="card-title mb-1">{w.onTimeRate}</h2>
            <p className="tabular text-4xl font-semibold tracking-tight">
              <CountUp value={Math.round(report.onTimeRate * 100)} suffix="%" />
            </p>
            <p className="mb-5 mt-1 text-sm text-muted">{fmt(w.onTimeRateNote, { n: report.buckets.early + report.buckets.onTime + report.buckets.late })}</p>
            <h3 className="mb-3 text-sm font-medium text-ink-2">{w.byBoard}</h3>
            {report.byBoardRate.length === 0 ? <p className="text-sm text-muted">{w.byBoardEmpty}</p> : <BarList items={report.byBoardRate} />}
          </section>
        </div>

        <section className="card mt-[var(--gap)]" aria-labelledby="recent-completions">
          <h2 id="recent-completions" className="card-title mb-5 flex items-center gap-2">
            {w.recentTitle}
            <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium">{report.rows.length}</span>
          </h2>
          {report.rows.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted">{w.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                    <th className="pb-3 pr-4 font-medium">{w.colTask}</th>
                    <th className="pb-3 pr-4 font-medium">{w.colBoard}</th>
                    <th className="pb-3 pr-4 font-medium">{w.colDue}</th>
                    <th className="pb-3 pr-4 font-medium">{w.colCompleted}</th>
                    <th className="pb-3 font-medium">{w.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="py-3 pr-4 font-medium">{r.title}</td>
                      <td className="py-3 pr-4 text-ink-2">{r.board}</td>
                      <td className="tabular py-3 pr-4 text-ink-2">{fmtDate(r.dueDate)}</td>
                      <td className="tabular py-3 pr-4 text-ink-2">{fmtDateTime(r.completedAt)}</td>
                      <td className="py-3">
                        <span className="badge inline-flex items-center gap-1.5">
                          <span className={`size-1.5 rounded-full ${BUCKET_DOT[r.bucket]}`} aria-hidden />
                          {bucketLabel[r.bucket]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </StaggerReveal>
    </>
  );
}
