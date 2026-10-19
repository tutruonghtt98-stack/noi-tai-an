import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { db } from "@/lib/db";
import { effectivePlan } from "@/lib/plan";
import { vnd } from "@/lib/billing";
import { expireStaleOrders } from "@/lib/payments/orders";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Gói & thanh toán" };

export default async function BillingPage() {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  await expireStaleOrders();
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const plan = effectivePlan(user);
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", { dateStyle: "medium", timeZone: user.timezone });
  const planName = plan === "FREE" ? t.billing.free.name : plan === "PRO" ? t.billing.pro.name : t.billing.team.name;

  return (
    <>
      <PageHeader title={t.billing.manage} />
      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="card hero-glow h-fit" aria-labelledby="cur">
          <p id="cur" className="text-sm text-muted">
            {t.billing.current}
          </p>
          <p className="mt-1 text-4xl font-semibold">{planName}</p>
          {plan !== "FREE" && user.planExpiresAt && (
            <p className="mt-2 text-ink-2">{fmt(t.billing.validUntil, { d: dateFmt.format(user.planExpiresAt) })}</p>
          )}
          {plan === "TEAM" && user.teamSeats && (
            <p className="mt-1 text-sm text-muted">
              {user.teamSeats} {t.billing.seats.toLowerCase()}
            </p>
          )}
          <Link href="/pricing" className="btn btn-primary mt-6 w-full">
            {plan === "FREE" ? t.billing.upgrade : t.billing.renew}
          </Link>
        </section>

        <section className="card min-w-0" aria-labelledby="hist">
          <h2 id="hist" className="card-title mb-4">
            {t.billing.history}
          </h2>
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{t.billing.noHistory}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-ink-2">
                  <tr className="border-b border-line">
                    <th className="py-3 pr-4 font-medium">{t.billing.order}</th>
                    <th className="py-3 pr-4 font-medium">{t.analytics.date}</th>
                    <th className="py-3 pr-4 font-medium">{t.settings.plan}</th>
                    <th className="py-3 pr-4 text-right font-medium">{t.billing.amount}</th>
                    <th className="py-3 text-right font-medium">{t.billing.statusLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-line last:border-0">
                      <td className="py-3 pr-4 font-mono">
                        {o.status === "PENDING" ? (
                          <Link href={`/billing/checkout/${o.code}`} className="underline underline-offset-4">
                            {o.code}
                          </Link>
                        ) : (
                          o.code
                        )}
                      </td>
                      <td className="py-3 pr-4">{dateFmt.format(o.createdAt)}</td>
                      <td className="py-3 pr-4">
                        {o.plan} · {t.billing.cycle[o.cycle]}
                        {o.plan === "TEAM" && ` · ${o.seats}`}
                      </td>
                      <td className="tabular py-3 pr-4 text-right">{vnd(o.amount)}</td>
                      <td className="py-3 text-right">
                        <span
                          className={cn(
                            "badge",
                            o.status === "PAID" && "bg-jade-soft text-jade-ink",
                            o.status === "PENDING" && "bg-ochre-soft text-ochre-ink",
                          )}
                        >
                          {t.billing.status[o.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
