import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { vnd } from "@/lib/billing";
import { getWorkProducts, getWorkProductStats, getWorkProductCategories, PRODUCT_STATUSES, type ProductStatus } from "@/lib/work-queries";
import { CountUp } from "@/components/ui/count-up";
import { SegmentLinks } from "@/components/ui/segment-links";
import { SplitHeading } from "@/components/ui/split-heading";
import { ProductToolbar } from "./toolbar";
import { AddProductButton } from "./add-product-form";
import { ProductCardControls } from "./card-controls";

export const metadata: Metadata = { title: "Sản phẩm" };

const STATUS_BADGE: Record<ProductStatus, string> = {
  ACTIVE: "",
  DRAFT: "bg-surface-3 text-ink-2",
  ARCHIVED: "bg-surface-3 text-ink-2",
};

export default async function WorkProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; status?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const w = t.work.products;
  const sp = await searchParams;
  const category = sp.category && sp.category !== "all" ? sp.category : "all";
  const status: ProductStatus | "all" = PRODUCT_STATUSES.includes(sp.status as ProductStatus) ? (sp.status as ProductStatus) : "all";
  const search = sp.q ?? "";

  const [products, stats, categories] = await Promise.all([
    getWorkProducts(user.id, { search, category, status }),
    getWorkProductStats(user.id),
    getWorkProductCategories(user.id),
  ]);

  const href = (next: Partial<{ q: string; category: string; status: ProductStatus | "all" }>) => {
    const merged = { q: search, category, status, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.category !== "all") params.set("category", merged.category);
    if (merged.status !== "all") params.set("status", merged.status);
    const qs = params.toString();
    return `/work/products${qs ? `?${qs}` : ""}`;
  };

  const statusLabel: Record<ProductStatus, string> = { ACTIVE: w.statusActive, DRAFT: w.statusDraft, ARCHIVED: w.statusArchived };

  const lowStockNote =
    stats.lowStockCount === 0
      ? w.statLowStockEmpty
      : stats.lowStockCount === 1
        ? fmt(w.statLowStockOne, { name: stats.lowStockName ?? "" })
        : fmt(w.statLowStockNote, { name: stats.lowStockName ?? "", n: stats.lowStockCount - 1 });
  const outOfStockNote =
    stats.outOfStockCount === 0
      ? w.statOutOfStockEmpty
      : stats.outOfStockCount === 1
        ? fmt(w.statLowStockOne, { name: stats.outOfStockName ?? "" })
        : fmt(w.statLowStockNote, { name: stats.outOfStockName ?? "", n: stats.outOfStockCount - 1 });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div>
          <SplitHeading text={w.title} className="text-3xl font-semibold sm:text-[2.5rem]" />
          <p className="mt-2 text-ink-2">{w.subtitle}</p>
        </div>
        <span className="badge inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          <CountUp value={products.length} /> {w.liveNow}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <SegmentLinks
          ariaLabel={w.categoryAll}
          active={category}
          items={[{ value: "all", href: href({ category: "all" }), label: w.categoryAll }, ...categories.map((c) => ({ value: c, href: href({ category: c }), label: c }))]}
        />
        <div className="flex items-center gap-2">
          <a href={`/api/work/products/export?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(category !== "all" ? { category } : {}), ...(status !== "all" ? { status } : {}) }).toString()}`} className="btn btn-soft">
            <Download className="size-4" aria-hidden /> {w.export}
          </a>
          <AddProductButton />
        </div>
      </div>

      <SegmentLinks
        ariaLabel={w.statusAll}
        active={status}
        className="mb-6 max-w-full"
        items={[
          { value: "all", href: href({ status: "all" }), label: w.statusAll },
          ...PRODUCT_STATUSES.map((s) => ({ value: s, href: href({ status: s }), label: statusLabel[s] })),
        ]}
      />

      <section className="card grid grid-cols-2 gap-3 p-3 sm:p-4 lg:grid-cols-4" aria-label={w.title}>
        <div className="rounded-[1.5rem] bg-ink p-5 text-bg">
          <p className="text-sm font-medium opacity-70">{w.statStockValue}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.stockValueCents} shape="vnd" />
          </p>
          <p className="mt-3 text-sm opacity-70">{fmt(w.statStockValueNote, { n: stats.unitsOnHand })}</p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{w.statLowStock}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.lowStockCount} />
          </p>
          <p className="mt-3 truncate text-sm text-muted" title={lowStockNote}>
            {lowStockNote}
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{w.statOutOfStock}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.outOfStockCount} />
          </p>
          <p className="mt-3 truncate text-sm text-muted" title={outOfStockNote}>
            {outOfStockNote}
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{w.statAvgMargin}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
            <CountUp value={stats.avgMargin * 100} suffix="%" />
          </p>
          <p className="mt-3 text-sm text-muted">{fmt(w.statAvgMarginNote, { n: stats.activeCount })}</p>
        </div>
      </section>

      <section className="card mt-[var(--gap)]" aria-labelledby="products-grid">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="products-grid" className="card-title flex items-center gap-2">
            {w.tableTitle}
            <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium">{products.length}</span>
          </h2>
          <ProductToolbar search={search} category={category} status={status} searchPh={w.searchPh} />
        </div>

        {products.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted">{w.empty}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const margin = p.priceCents > 0 ? (p.priceCents - p.costCents) / p.priceCents : 0;
              const stockPct = p.reorderAt > 0 ? Math.min(100, Math.round((p.stock / (p.reorderAt * 2)) * 100)) : p.stock > 0 ? 100 : 0;
              const stockColor = p.stock === 0 ? "bg-danger" : p.stock <= p.reorderAt ? "bg-ochre" : "bg-success";
              const initials = p.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((wd) => wd[0]!.toUpperCase())
                .join("");
              return (
                <div key={p.id} className="group relative rounded-[1.25rem] border border-line bg-surface p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-sm font-semibold text-accent-ink">{initials || "?"}</span>
                    <div className="flex items-center gap-1.5">
                      {p.status !== "ACTIVE" && <span className={`badge ${STATUS_BADGE[p.status as ProductStatus]}`}>{statusLabel[p.status as ProductStatus]}</span>}
                      {p.stock === 0 ? (
                        <span className="badge bg-danger/15 text-danger">{w.statOutOfStock}</span>
                      ) : p.stock <= p.reorderAt ? (
                        <span className="badge bg-ochre/20 text-ochre-ink">{w.statLowStock}</span>
                      ) : null}
                    </div>
                  </div>
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted">{p.sku}</p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="tabular text-lg font-semibold">{vnd(p.priceCents)}</span>
                    <span className="tabular text-xs text-muted">{fmt(w.margin, { pct: `${Math.round(margin * 100)}%` })}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-ink-2">
                    <span className="tabular">{p.stock} {w.colStock.toLowerCase()}</span>
                    <span className="tabular text-muted">{fmt(w.reorderAt, { n: p.reorderAt })}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span className={`block h-full rounded-full ${stockColor}`} style={{ width: `${stockPct}%` }} />
                  </div>
                  <p className="tabular mt-2 text-xs text-muted">{fmt(w.sold30, { n: p.soldCount })}</p>
                  <div className="mt-3 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                    <ProductCardControls productId={p.id} status={p.status} statusLabel={statusLabel} deleteLabel={w.delete} confirmDelete={w.confirmDelete} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
