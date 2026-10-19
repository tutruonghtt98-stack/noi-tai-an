/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, CircleX } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { db } from "@/lib/db";
import { vnd } from "@/lib/billing";
import { CheckoutWatcher, CopyField } from "./watcher";

export const metadata: Metadata = { title: "Thanh toán" };

export default async function CheckoutPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const { code } = await params;
  const order = await db.order.findFirst({ where: { code, userId: user.id } });
  if (!order) notFound();

  const expired = order.status === "EXPIRED" || (order.status === "PENDING" && order.expiresAt < new Date());
  const planName = order.plan === "PRO" ? t.billing.pro.name : t.billing.team.name;

  if (order.status === "PAID") {
    return (
      <section className="card mx-auto max-w-lg py-12 text-center">
        <CircleCheck className="mx-auto size-14 text-success" aria-hidden />
        <h1 className="mt-4 text-3xl font-semibold">{t.billing.paid}</h1>
        <p className="mt-2 text-ink-2">{fmt(t.billing.paidDesc, { plan: planName })}</p>
        <Link href="/dashboard" className="btn btn-primary mt-8">
          {t.billing.toDashboard}
        </Link>
      </section>
    );
  }
  if (order.status === "CANCELLED" || expired) {
    return (
      <section className="card mx-auto max-w-lg py-12 text-center">
        <CircleX className="mx-auto size-14 text-muted" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">{expired ? t.billing.expired : t.billing.cancelled}</h1>
        <Link href="/pricing" className="btn btn-primary mt-8">
          {t.billing.tryAgain}
        </Link>
      </section>
    );
  }
  if (order.provider === "payos" && order.checkoutUrl) {
    return (
      <section className="card mx-auto max-w-lg py-12 text-center">
        <h1 className="text-2xl font-semibold">{t.billing.checkoutTitle}</h1>
        <a href={order.checkoutUrl} className="btn btn-primary mt-8">
          PayOS →
        </a>
        <CheckoutWatcher code={code} provider="payos" />
      </section>
    );
  }

  const bank = process.env.SEPAY_BANK ?? "MBBank";
  const acc = process.env.SEPAY_ACCOUNT_NO ?? "0000000000";
  const accName = process.env.SEPAY_ACCOUNT_NAME ?? "NOI TAI AN";
  const qr = `https://qr.sepay.vn/img?acc=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bank)}&amount=${order.amount}&des=${order.code}&template=compact`;
  const minutesLeft = Math.max(0, Math.round((order.expiresAt.getTime() - Date.now()) / 60_000));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-3xl font-semibold">{t.billing.checkoutTitle}</h1>
      <p className="mb-6 text-ink-2">
        {planName} · {t.billing.cycle[order.cycle]}
        {order.plan === "TEAM" && ` · ${order.seats} ${t.billing.seats.toLowerCase()}`} · {t.billing.order} <span className="font-mono">{order.code}</span>
      </p>
      {order.provider === "mock" && <p className="mb-4 rounded-2xl bg-ochre-soft p-4 text-sm text-ochre-ink">{t.billing.mockNote}</p>}

      <div className="grid grid-cols-1 gap-[var(--gap)] md:grid-cols-[300px_minmax(0,1fr)]">
        <section className="card flex flex-col items-center text-center" aria-label={t.billing.scanQr}>
          {order.provider === "mock" ? (
            <div className="grid aspect-square w-full max-w-[240px] place-items-center rounded-2xl border-2 border-dashed border-line text-sm text-muted">VietQR (demo)</div>
          ) : (
            <img src={qr} alt={`VietQR ${vnd(order.amount)} — ${order.code}`} width={240} height={240} className="w-full max-w-[240px] rounded-2xl bg-white p-2" />
          )}
          <p className="mt-4 text-sm text-ink-2">{t.billing.scanQr}</p>
          <p className="mt-1 text-xs text-muted">{fmt(t.billing.expiresIn, { m: minutesLeft })}</p>
        </section>

        <section className="card grid content-start gap-3" aria-label={t.billing.checkoutTitle}>
          <CopyField label={t.billing.bank} value={bank} />
          <CopyField label={t.billing.accountNo} value={acc} copy />
          <CopyField label={t.billing.accountName} value={accName} />
          <CopyField label={t.billing.amount} value={vnd(order.amount)} copyValue={String(order.amount)} copy strong />
          <CopyField label={t.billing.content} value={order.code} copy strong />
          <p className="rounded-xl bg-ochre-soft px-4 py-3 text-sm text-ochre-ink">{t.billing.contentWarn}</p>
          <CheckoutWatcher code={code} provider={order.provider} />
        </section>
      </div>
    </div>
  );
}
