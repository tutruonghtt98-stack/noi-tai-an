import type { Metadata } from "next";
import { ArrowDown, ArrowUp } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { vnd } from "@/lib/billing";
import { getWorkAnalytics } from "@/lib/work-queries";
import type { OrderChannelFilter } from "@/lib/work-types";
import { CountUp } from "@/components/ui/count-up";
import { SegmentLinks } from "@/components/ui/segment-links";
import { SplitHeading } from "@/components/ui/split-heading";
import { ColumnChart } from "@/components/charts";

export const metadata: Metadata = { title: "Phân tích" };

const PERIODS = [7, 30, 90, 365] as const;
type Period = (typeof PERIODS)[number];

function ChangeBadge({ value }: { value: number }) {
  const pct = Math.round(Math.abs(value) * 100);
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 ${up ? "text-success" : "text-danger"}`}>
      {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      {pct}%
    </span>
  );
}

export default async function WorkAnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string; channel?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.work.analytics;
  const sp = await searchParams;
  const period: Period = PERIODS.includes(Number(sp.period) as Period) ? (Number(sp.period) as Period) : 30;
  const channel: OrderChannelFilter = sp.channel === "online" || sp.channel === "in_store" ? sp.channel : "all";

  const data = await getWorkAnalytics(user.id, { days: period, channel });

  const href = (next: Partial<{ period: Period; channel: OrderChannelFilter }>) => {
    const merged = { period, channel, ...next };
    const params = new URLSearchParams();
    if (merged.period !== 30) params.set("period", String(merged.period));
    if (merged.channel !== "all") params.set("channel", merged.channel);
    const qs = params.toString();
    return `/work/analytics${qs ? `?${qs}` : ""}`;
  };

  const periodLabel: Record<Period, string> = { 7: w.period7, 30: w.period30, 90: w.period90, 365: w.period365 };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <SplitHeading text={w.title} className="text-3xl font-semibold sm:text-[2.5rem]" />
          <p className="mt-2 text-ink-2">{w.subtitle}</p>
        </div>
        <span className="badge inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          <CountUp value={data.orderCount} /> {w.liveNow}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SegmentLinks ariaLabel={w.title} active={String(period)} items={PERIODS.map((p) => ({ value: String(p), href: href({ period: p }), label: periodLabel[p] }))} />
        <SegmentLinks
          ariaLabel={w.channelAll}
          active={channel}
          items={[
            { value: "all", href: href({ channel: "all" }), label: w.channelAll },
            { value: "online", href: href({ channel: "online" }), label: w.channelOnline },
            { value: "in_store", href: href({ channel: "in_store" }), label: w.channelInStore },
          ]}
        />
      </div>

      <section className="card grid grid-cols-2 gap-3 p-3 sm:p-4 lg:grid-cols-4" aria-label={w.title}>
        <div className="rounded-[1.5rem] bg-ink p-5 text-bg">
          <p className="text-sm font-medium opacity-70">{w.statRevenue}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={data.revenueCents} shape="vnd" />
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-sm opacity-70">
            <ChangeBadge value={data.revenueChange} /> {w.vsPrevious}
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{w.statOrders}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={data.orderCount} />
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
            <ChangeBadge value={data.orderChange} /> {w.vsPrevious}
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{w.statAov}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={data.aovCents} shape="vnd" />
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
            <ChangeBadge value={data.aovChange} /> {w.vsPrevious}
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{w.statReturning}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={data.returningRate * 100} suffix="%" />
          </p>
          <p className="mt-3 text-sm text-muted">{w.subtitle}</p>
        </div>
      </section>

      <div className="mt-[var(--gap)] grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-label={w.revenueOverTime}>
          <div className="mb-1 flex items-start justify-between gap-3">
            <h2 className="card-title">{w.revenueOverTime}</h2>
          </div>
          <p className="mb-5 text-sm text-muted">{w.revenueUnit}</p>
          <ColumnChart points={data.dailyRevenue} color="var(--ink)" height={220} />
        </section>

        <section className="card" aria-label={w.onlineVsStore}>
          <h2 className="card-title mb-5">{w.onlineVsStore}</h2>
          <div className="mb-5 flex items-center gap-1 overflow-hidden rounded-full">
            <span className="h-2 bg-ink" style={{ width: `${Math.round(data.online.share * 100)}%` }} />
            <span className="h-2 flex-1 bg-surface-3" />
          </div>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <span className="size-2 rounded-full bg-ink" aria-hidden />
                  {w.online}
                </p>
                <p className="mt-0.5 text-xs text-muted">{fmt(w.ordersNote, { n: data.online.orders, avg: vnd(data.online.orders ? Math.round(data.online.revenueCents / data.online.orders) : 0) })}</p>
              </div>
              <p className="tabular shrink-0 font-semibold">{vnd(data.online.revenueCents)}</p>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <span className="size-2 rounded-full bg-surface-3" aria-hidden />
                  {w.inStore}
                </p>
                <p className="mt-0.5 text-xs text-muted">{fmt(w.ordersNote, { n: data.inStore.orders, avg: vnd(data.inStore.orders ? Math.round(data.inStore.revenueCents / data.inStore.orders) : 0) })}</p>
              </div>
              <p className="tabular shrink-0 font-semibold">{vnd(data.inStore.revenueCents)}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-[var(--gap)] grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-2">
        <section className="card" aria-label={w.topProducts}>
          <h2 className="card-title mb-5">{w.topProducts}</h2>
          {data.topProducts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">{w.topProductsEmpty}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="pb-3 pr-4 font-medium">{w.colProduct}</th>
                  <th className="pb-3 pr-4 text-right font-medium">{w.colUnits}</th>
                  <th className="pb-3 text-right font-medium">{w.colRevenue}</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="py-3 pr-4">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted">{p.category}</p>
                    </td>
                    <td className="tabular py-3 pr-4 text-right">{p.soldCount}</td>
                    <td className="tabular py-3 text-right font-medium">{vnd(p.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card" aria-label={w.whenPeopleBuy}>
          <h2 className="card-title mb-5">{w.whenPeopleBuy}</h2>
          <ColumnChart points={data.weekdayOrders} color="var(--ink)" suffix={` ${w.ordersUnit}`} height={220} />
        </section>
      </div>
    </>
  );
}
