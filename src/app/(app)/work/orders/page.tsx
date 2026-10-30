import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { vnd } from "@/lib/billing";
import { getWorkOrders, getWorkOrderStats, ORDER_STATUSES, type OrderChannelFilter, type OrderStatus } from "@/lib/work-queries";
import { CountUp } from "@/components/ui/count-up";
import { SegmentLinks } from "@/components/ui/segment-links";
import { Avatar } from "@/components/ui/avatar";
import { SplitHeading } from "@/components/ui/split-heading";
import { OrderToolbar } from "./toolbar";
import { AddOrderButton } from "./add-order-form";
import { OrderRowControls } from "./row-controls";

export const metadata: Metadata = { title: "Đơn hàng" };

const STATUS_DOT: Record<OrderStatus, string> = {
  PENDING: "bg-ochre",
  PAID: "bg-mist",
  PACKED: "bg-mist",
  SHIPPED: "bg-jade",
  DELIVERED: "bg-success",
  CLOSED: "bg-muted",
};

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; channel?: string; sort?: string }>;
}) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.work.orders;
  const sp = await searchParams;
  const status: OrderStatus | "all" = ORDER_STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : "all";
  const channel: OrderChannelFilter = sp.channel === "online" || sp.channel === "in_store" ? sp.channel : "all";
  const sort = sp.sort === "total" ? "total" : "recent";
  const search = sp.q ?? "";

  const [orders, stats] = await Promise.all([getWorkOrders(user.id, { search, status, channel, sort }), getWorkOrderStats(user.id)]);

  const href = (next: Partial<{ q: string; status: OrderStatus | "all"; channel: OrderChannelFilter; sort: "recent" | "total" }>) => {
    const merged = { q: search, status, channel, sort, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.channel !== "all") params.set("channel", merged.channel);
    if (merged.sort !== "recent") params.set("sort", merged.sort);
    const qs = params.toString();
    return `/work/orders${qs ? `?${qs}` : ""}`;
  };

  const statusLabel: Record<OrderStatus, string> = {
    PENDING: w.statusPending,
    PAID: w.statusPaid,
    PACKED: w.statusPacked,
    SHIPPED: w.statusShipped,
    DELIVERED: w.statusDelivered,
    CLOSED: w.statusClosed,
  };

  const placedLabel = (d: Date) => {
    const diffMs = Date.now() - d.getTime();
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours < 1) return w.justNow;
    if (hours < 24) return fmt(w.hoursAgo, { n: hours });
    const days = Math.floor(hours / 24);
    if (days === 1) return w.yesterday;
    return fmt(w.daysAgo, { n: days });
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <SplitHeading text={w.title} className="text-3xl font-semibold sm:text-[2.5rem]" />
          <p className="mt-2 text-ink-2">{w.subtitle}</p>
        </div>
        <span className="badge inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          <CountUp value={stats.total} /> {w.liveNow}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SegmentLinks
          ariaLabel={w.tableTitle}
          active={status}
          items={[
            { value: "all", href: href({ status: "all" }), label: stats.total > 0 ? `${w.statusAll} ${stats.total}` : w.statusAll },
            ...ORDER_STATUSES.map((s) => ({
              value: s,
              href: href({ status: s }),
              label: stats.byStatus[s] > 0 ? `${statusLabel[s]} ${stats.byStatus[s]}` : statusLabel[s],
            })),
          ]}
        />
        <div className="flex items-center gap-2">
          <a
            href={`/api/work/orders/export?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(status !== "all" ? { status } : {}), ...(channel !== "all" ? { channel } : {}) }).toString()}`}
            className="btn btn-soft"
          >
            <Download className="size-4" aria-hidden /> {w.export}
          </a>
          <AddOrderButton />
        </div>
      </div>

      <SegmentLinks
        ariaLabel={w.fieldChannel}
        active={channel}
        className="mb-6 max-w-full"
        items={[
          { value: "all", href: href({ channel: "all" }), label: w.channelAll },
          { value: "online", href: href({ channel: "online" }), label: w.channelOnline },
          { value: "in_store", href: href({ channel: "in_store" }), label: w.channelInStore },
        ]}
      />

      <section className="card grid grid-cols-2 gap-3 p-3 sm:p-4 lg:grid-cols-4" aria-label={w.tableTitle}>
        <div className="rounded-[1.5rem] bg-ink p-5 text-bg">
          <p className="text-sm font-medium opacity-70">{w.statOpen}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.open} />
          </p>
          <p className="mt-3 text-sm opacity-70">{fmt(w.statOpenNote, { n: stats.awaitingPayment })}</p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{w.statToShip}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.toShip} />
          </p>
          <p className="mt-3 text-sm text-muted">{fmt(w.statToShipNote, { packed: stats.packed, toPack: stats.toPack })}</p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{w.statAvg}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.avgOrderCents} shape="vnd" />
          </p>
          <p className="mt-3 text-sm text-muted">{fmt(w.statAvgNote, { n: stats.total })}</p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{w.statRefunds}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.refundsThisMonth} shape="vnd" />
          </p>
          <p className="mt-3 text-sm text-muted">{stats.refundCount > 0 ? fmt(w.statRefundsNote, { n: stats.refundCount }) : w.statRefundsEmpty}</p>
        </div>
      </section>

      <section className="card mt-[var(--gap)]" aria-labelledby="orders-table">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="orders-table" className="card-title flex items-center gap-2">
            {w.tableTitle}
            <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium">{orders.length}</span>
          </h2>
          <OrderToolbar search={search} status={status} channel={channel} sort={sort} searchPh={w.searchPh} />
        </div>

        {orders.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted">{w.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="pb-3 pr-4 font-medium">{w.colOrder}</th>
                  <th className="pb-3 pr-4 font-medium">{w.colCustomer}</th>
                  <th className="pb-3 pr-4 font-medium">{w.colPlaced}</th>
                  <th className="pb-3 pr-4 font-medium">{w.colChannel}</th>
                  <th className="pb-3 pr-4 text-right font-medium">{w.colItems}</th>
                  <th className="pb-3 pr-4 text-right font-medium">{w.colTotal}</th>
                  <th className="pb-3 pr-4 font-medium">{w.colPayment}</th>
                  <th className="pb-3 pr-4 font-medium">{w.colStatus}</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((row) => (
                  <tr key={row.id} className="group border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="tabular py-3 pr-4 font-medium">#{row.orderNo}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.customerName} size={32} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.customerName}</p>
                          {row.customerCity && <p className="truncate text-xs text-muted">{row.customerCity}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-ink-2">{placedLabel(row.placedAt)}</td>
                    <td className="py-3 pr-4 text-ink-2">{row.channel === "ONLINE" ? w.channelOnline : w.channelInStore}</td>
                    <td className="tabular py-3 pr-4 text-right">{row.items}</td>
                    <td className="tabular py-3 pr-4 text-right font-medium">{vnd(row.totalCents)}</td>
                    <td className="py-3 pr-4 text-ink-2">{row.payment}</td>
                    <td className="py-3 pr-4">
                      <span className="badge inline-flex items-center gap-1.5">
                        <span className={`size-1.5 rounded-full ${STATUS_DOT[row.status as OrderStatus]}`} aria-hidden />
                        {statusLabel[row.status as OrderStatus]}
                      </span>
                    </td>
                    <td className="py-3 pl-2 text-right">
                      <OrderRowControls orderId={row.id} status={row.status} statusLabel={statusLabel} deleteLabel={w.delete} confirmDelete={w.confirmDelete} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
