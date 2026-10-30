import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { vnd } from "@/lib/billing";
import { getWorkCustomers, getWorkStats, type WorkFilter, type WorkSort } from "@/lib/work-queries";
import { CountUp } from "@/components/ui/count-up";
import { SegmentLinks } from "@/components/ui/segment-links";
import { Avatar } from "@/components/ui/avatar";
import { SplitHeading } from "@/components/ui/split-heading";
import { CustomerToolbar } from "./toolbar";
import { AddCustomerButton } from "./add-customer-form";
import { DeleteCustomerButton } from "./delete-button";

export const metadata: Metadata = { title: "Khách hàng" };

const FILTERS: WorkFilter[] = ["all", "vip", "wholesale", "new", "subscribers"];

export default async function WorkCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; sort?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const sp = await searchParams;
  const filter: WorkFilter = FILTERS.includes(sp.filter as WorkFilter) ? (sp.filter as WorkFilter) : "all";
  const sort: WorkSort = sp.sort === "orders" || sp.sort === "recent" ? sp.sort : "spend";
  const search = sp.q ?? "";

  const [customers, stats] = await Promise.all([getWorkCustomers(user.id, { search, filter, sort }), getWorkStats(user.id)]);

  const href = (next: Partial<{ q: string; filter: WorkFilter; sort: WorkSort }>) => {
    const merged = { q: search, filter, sort, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.filter !== "all") params.set("filter", merged.filter);
    if (merged.sort !== "spend") params.set("sort", merged.sort);
    const qs = params.toString();
    return `/work/customers${qs ? `?${qs}` : ""}`;
  };

  const c = t.work.customers;
  const filterCount: Record<WorkFilter, number> = {
    all: stats.total,
    vip: stats.vip,
    wholesale: stats.wholesale,
    new: stats.newThisMonth,
    subscribers: stats.subscribers,
  };
  const filterLabel: Record<WorkFilter, string> = {
    all: c.filterAll,
    vip: c.filterVip,
    wholesale: c.filterWholesale,
    new: c.filterNew,
    subscribers: c.filterSubscribers,
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <SplitHeading text={c.title} className="text-3xl font-semibold sm:text-[2.5rem]" />
          <p className="mt-2 text-ink-2">{c.subtitle}</p>
        </div>
        <span className="badge inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          <CountUp value={stats.total} /> {c.liveNow}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="segmented bg-surface shadow-card">
          <span aria-current="page">{c.tabCustomers}</span>
          <span className="cursor-not-allowed opacity-50" title={t.common.comingSoon}>
            {c.tabFeedback}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/work/customers/export?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(filter !== "all" ? { filter } : {}) }).toString()}`} className="btn btn-soft">
            <Download className="size-4" aria-hidden /> {c.export}
          </a>
          <AddCustomerButton />
        </div>
      </div>

      <SegmentLinks
        ariaLabel={c.tableTitle}
        active={filter}
        className="mb-6 max-w-full"
        items={FILTERS.map((f) => ({
          value: f,
          href: href({ filter: f }),
          label: (
            <span className="inline-flex items-center gap-1.5">
              {filterLabel[f]}
              {filterCount[f] > 0 && <span className="tabular rounded-full bg-surface-2 px-1.5 py-0.5 text-xs">{filterCount[f]}</span>}
            </span>
          ),
        }))}
      />

      <section className="card grid grid-cols-2 gap-3 p-3 sm:p-4 lg:grid-cols-4" aria-label={c.tableTitle}>
        <div className="rounded-[1.5rem] bg-ink p-5 text-bg">
          <p className="text-sm font-medium opacity-70">{c.statCustomers}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.total} />
          </p>
          <p className="mt-3 text-sm opacity-70">{fmt(c.statCustomersNote, { online: stats.online, store: stats.inStore })}</p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{c.statNew}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.newThisMonth} />
          </p>
          <p className="mt-3 text-sm text-muted">{c.statNewNote}</p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{c.statRepeat}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.repeatRate * 100} suffix="%" />
          </p>
          <p className="mt-3 text-sm text-muted">{c.statRepeatNote}</p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{c.statAvgValue}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.avgLifetimeCents} shape="vnd" />
          </p>
          <p className="mt-3 text-sm text-muted">{fmt(c.statAvgValueNote, { total: vnd(stats.totalLifetimeCents) })}</p>
        </div>
      </section>

      <section className="card mt-[var(--gap)]" aria-labelledby="customers-table">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="customers-table" className="card-title flex items-center gap-2">
            {c.tableTitle}
            <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium">{customers.length}</span>
          </h2>
          <CustomerToolbar search={search} sort={sort} filter={filter} labels={{ searchPh: c.searchPh, spend: c.sortHighestSpend, orders: c.sortMostOrders, recent: c.sortRecent }} />
        </div>

        {customers.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted">{c.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="pb-3 pr-4 font-medium">{c.colCustomer}</th>
                  <th className="pb-3 pr-4 font-medium">{c.colCity}</th>
                  <th className="pb-3 pr-4 font-medium">{c.colChannel}</th>
                  <th className="pb-3 pr-4 text-right font-medium">{c.colOrders}</th>
                  <th className="pb-3 pr-4 text-right font-medium">{c.colSpend}</th>
                  <th className="pb-3 pr-4 font-medium">{c.colLastOrder}</th>
                  <th className="pb-3 pr-4 font-medium">{c.colTags}</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {customers.map((row) => (
                  <tr key={row.id} className="group border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.name} size={36} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.name}</p>
                          <p className="truncate text-xs text-muted">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-ink-2">{row.city ?? "—"}</td>
                    <td className="py-3 pr-4 text-ink-2">{row.channel === "ONLINE" ? c.channelOnline : c.channelInStore}</td>
                    <td className="tabular py-3 pr-4 text-right">{row.orders}</td>
                    <td className="tabular py-3 pr-4 text-right font-medium">{vnd(row.lifetimeCents)}</td>
                    <td className="py-3 pr-4 text-ink-2">{row.lastOrderAt ? row.lastOrderAt.toISOString().slice(0, 10) : "—"}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1.5">
                        {row.tags.map((tag) => (
                          <span key={tag} className="badge">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pl-2 text-right">
                      <DeleteCustomerButton id={row.id} label={c.delete} confirm={c.confirmDelete} />
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
