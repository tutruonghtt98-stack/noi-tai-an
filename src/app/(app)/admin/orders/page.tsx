import type { Metadata } from "next";
import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { vnd } from "@/lib/billing";
import { expireStaleOrders } from "@/lib/payments/orders";
import { OrderActions } from "./actions";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Quản trị · Giao dịch" };

const STATUS: Record<OrderStatus, string> = { PENDING: "Chờ", PAID: "Đã thanh toán", CANCELLED: "Đã huỷ", EXPIRED: "Hết hạn" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const admin = await requireAdmin();
  await expireStaleOrders();
  const sp = await searchParams;
  const status = (Object.keys(STATUS) as OrderStatus[]).includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined;
  const q = (sp.q ?? "").trim().toUpperCase().slice(0, 40);
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ code: { contains: q } }, { user: { email: { contains: q.toLowerCase(), mode: "insensitive" } } }] } : {}),
  };
  const [orders, sums] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { email: true, name: true } } } }),
    db.order.groupBy({ by: ["status"], _sum: { amount: true }, _count: true }),
  ]);
  const fmt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: admin.timezone });

  return (
    <section className="card min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav className="segmented max-w-full overflow-x-auto" aria-label="Lọc trạng thái">
          <Link href="/admin/orders" aria-current={!status ? "page" : undefined}>
            Tất cả
          </Link>
          {(Object.keys(STATUS) as OrderStatus[]).map((s) => (
            <Link key={s} href={`/admin/orders?status=${s}`} aria-current={status === s ? "page" : undefined}>
              {STATUS[s]} <span className="tabular text-muted">{sums.find((x) => x.status === s)?._count ?? 0}</span>
            </Link>
          ))}
        </nav>
        <form role="search" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="oq" className="sr-only">
            Tìm mã đơn hoặc email
          </label>
          <input id="oq" name="q" defaultValue={sp.q} className="input w-full sm:w-64" placeholder="Mã đơn NTA… hoặc email" />
        </form>
      </div>
      <p className="mb-4 text-sm text-muted">
        Tổng đã thu: <span className="tabular font-semibold text-ink">{vnd(sums.find((x) => x.status === "PAID")?._sum.amount ?? 0)}</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-ink-2">
            <tr className="border-b border-line">
              <th className="py-3 pr-4 font-medium">Mã đơn</th>
              <th className="py-3 pr-4 font-medium">Khách hàng</th>
              <th className="py-3 pr-4 font-medium">Gói</th>
              <th className="py-3 pr-4 text-right font-medium">Số tiền</th>
              <th className="py-3 pr-4 font-medium">Cổng</th>
              <th className="py-3 pr-4 font-medium">Tạo lúc</th>
              <th className="py-3 pr-4 font-medium">Trạng thái</th>
              <th className="py-3 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0">
                <td className="py-3 pr-4 font-mono">{o.code}</td>
                <td className="max-w-56 truncate py-3 pr-4">{o.user.email ?? o.user.name}</td>
                <td className="py-3 pr-4">
                  {o.plan} · {o.cycle === "YEARLY" ? "Năm" : "Tháng"}
                  {o.plan === "TEAM" && ` · ${o.seats} chỗ`}
                </td>
                <td className="tabular py-3 pr-4 text-right">{vnd(o.amount)}</td>
                <td className="py-3 pr-4 uppercase text-muted">{o.provider}</td>
                <td className="py-3 pr-4">{fmt.format(o.createdAt)}</td>
                <td className="py-3 pr-4">
                  <span className={cn("badge", o.status === "PAID" && "bg-jade-soft text-jade-ink", o.status === "PENDING" && "bg-ochre-soft text-ochre-ink")}>{STATUS[o.status]}</span>
                  {o.providerRef && <span className="mt-0.5 block max-w-40 truncate text-xs text-muted" title={o.providerRef}>{o.providerRef}</span>}
                </td>
                <td className="py-3 text-right">{(o.status === "PENDING" || o.status === "EXPIRED") && <OrderActions id={o.id} code={o.code} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="py-10 text-center text-sm text-muted">Không có giao dịch.</p>}
      </div>
    </section>
  );
}
