import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { vnd } from "@/lib/billing";
import { addDays, isoInZone, rangeISO, toDbDate } from "@/lib/dates";
import { expireStaleOrders } from "@/lib/payments/orders";
import { ChartCard, ColumnChart, BarList } from "@/components/charts";

export const metadata: Metadata = { title: "Quản trị" };

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-[1.5rem] bg-surface-2 p-5">
      <p className="text-sm font-medium text-ink-2">{label}</p>
      <p className="tabular mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
    </div>
  );
}

export default async function AdminHome() {
  const admin = await requireAdmin();
  await expireStaleOrders();
  const now = new Date();
  const today = isoInZone(now, admin.timezone);
  const d30 = addDays(today, -29);
  const since7 = new Date(Date.now() - 7 * 86_400_000);

  const [users, new7, paying, plans, paid30, pending, active7] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: since7 } } }),
    db.user.findMany({
      where: { plan: { not: "FREE" }, planExpiresAt: { gt: now }, bannedAt: null },
      select: { id: true, plan: true },
    }),
    db.user.groupBy({ by: ["plan"], _count: true }),
    db.order.findMany({ where: { status: "PAID", paidAt: { gte: toDbDate(d30) } }, select: { amount: true, paidAt: true, cycle: true } }),
    db.order.count({ where: { status: "PENDING" } }),
    db.focusSession
      .groupBy({ by: ["userId"], where: { date: { gte: toDbDate(addDays(today, -6)) } } })
      .then(async (f) => {
        const ids = new Set(f.map((x) => x.userId));
        const logs = await db.habitLog.groupBy({ by: ["userId"], where: { date: { gte: toDbDate(addDays(today, -6)) } } });
        logs.forEach((l) => ids.add(l.userId));
        return ids.size;
      }),
  ]);

  // MRR ước tính: đơn đã thanh toán gần nhất của mỗi thuê bao đang hiệu lực, quy về tháng
  const lastOrders = await db.order.findMany({
    where: { status: "PAID", userId: { in: paying.map((p) => p.id) } },
    orderBy: { paidAt: "desc" },
    distinct: ["userId"],
    select: { amount: true, cycle: true },
  });
  const mrr = Math.round(lastOrders.reduce((s, o) => s + (o.cycle === "YEARLY" ? o.amount / 12 : o.amount), 0));
  const revenue30 = paid30.reduce((s, o) => s + o.amount, 0);

  const byDay = new Map<string, number>();
  for (const o of paid30) {
    const k = isoInZone(o.paidAt!, admin.timezone);
    byDay.set(k, (byDay.get(k) ?? 0) + o.amount);
  }
  const revenuePoints = rangeISO(d30, today).map((iso) => ({
    key: iso,
    label: `${iso.slice(8)}/${iso.slice(5, 7)}`,
    value: Math.round((byDay.get(iso) ?? 0) / 1000),
  }));
  const planCount = (p: string) => plans.find((x) => x.plan === p)?._count ?? 0;

  return (
    <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-2">
      <section className="card grid grid-cols-2 gap-3 p-3 sm:p-4 lg:col-span-2 lg:grid-cols-4" aria-label="KPI">
        <Kpi label="Người dùng" value={users.toLocaleString("vi-VN")} note={`+${new7} trong 7 ngày`} />
        <Kpi label="Hoạt động 7 ngày" value={active7.toLocaleString("vi-VN")} note={users ? `${Math.round((active7 / users) * 100)}% tổng số` : undefined} />
        <Kpi label="Thuê bao trả phí" value={paying.length.toLocaleString("vi-VN")} note={`MRR ≈ ${vnd(mrr)}`} />
        <Kpi label="Doanh thu 30 ngày" value={vnd(revenue30)} note={`${pending} đơn đang chờ`} />
      </section>
      <ChartCard title="Doanh thu theo ngày (nghìn ₫)" subtitle="30 ngày gần nhất" points={revenuePoints} suffix="k₫">
        <ColumnChart points={revenuePoints} suffix="k₫" />
      </ChartCard>
      <ChartCard title="Phân bổ gói" subtitle={`${users} người dùng`}>
        <BarList
          color="var(--chart-1)"
          items={(["FREE", "PRO", "TEAM"] as const).map((p) => ({
            id: p,
            label: p,
            value: users ? planCount(p) / users : 0,
            note: `${planCount(p)}`,
          }))}
        />
      </ChartCard>
    </div>
  );
}
