"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { startCheckout } from "@/actions/billing";
import { useToast } from "@/components/ui/toast";
import { vnd } from "@/lib/billing";
import { cn } from "@/lib/cn";

type Cycle = "MONTHLY" | "YEARLY";

export function PricingPlans({
  signedIn,
  hasAccess,
  prices,
  saving,
  configured,
}: {
  signedIn: boolean;
  hasAccess: boolean;
  prices: Record<Cycle, number>;
  saving: number;
  configured: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState<Cycle | null>(null);
  const [pending, start] = useTransition();

  const buy = (cycle: Cycle) => {
    setBusy(cycle);
    start(async () => {
      try {
        await startCheckout({ plan: "PRO", cycle });
      } catch (e) {
        // redirect() ném lỗi đặc biệt — chỉ báo lỗi thật
        if (!(e instanceof Error && e.message.includes("NEXT_REDIRECT"))) toast("error", t.common.error);
      } finally {
        setBusy(null);
      }
    });
  };

  const cycles: { id: Cycle; label: string; per: string }[] = [
    { id: "MONTHLY", label: t.billing.monthly, per: t.billing.perMonth },
    { id: "YEARLY", label: t.billing.yearly, per: t.billing.perYear },
  ];

  return (
    <>
      {!configured && <p className="mx-auto mb-6 max-w-xl rounded-2xl bg-rose-soft p-4 text-center text-sm text-rose-ink">{t.billing.notConfigured}</p>}

      <article className="card mx-auto flex max-w-xl flex-col py-10" aria-labelledby="plan-pro">
        <h2 id="plan-pro" className="text-xl font-semibold">
          {t.billing.pro.name}
        </h2>
        <p className="mt-1 text-sm text-ink-2">{t.billing.pro.desc}</p>
        {!hasAccess && (
          <p className="mt-3 rounded-xl bg-ochre-soft px-4 py-2.5 text-sm text-ochre-ink">{t.billing.trialEndedNote}</p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cycles.map(({ id, label, per }) => (
            <div key={id} className={cn("relative rounded-2xl border p-4", id === "YEARLY" ? "border-ink" : "border-line")}>
              {id === "YEARLY" && (
                <span className="absolute -top-3 right-4 rounded-full bg-jade-soft px-2 py-0.5 text-xs font-semibold text-jade-ink">
                  {fmt(t.billing.save, { n: saving })}
                </span>
              )}
              <p className="text-sm font-medium text-ink-2">{label}</p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="tabular text-3xl font-semibold tracking-tight">{vnd(prices[id])}</span>
                <span className="text-sm text-muted">{per}</span>
              </p>
              <div className="mt-4">
                {!signedIn ? (
                  <Link href="/login" className={cn("btn w-full", id === "YEARLY" ? "btn-primary" : "btn-soft")}>
                    {t.billing.signInToBuy}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={cn("btn w-full", id === "YEARLY" ? "btn-primary" : "btn-soft")}
                    disabled={!configured || pending}
                    onClick={() => buy(id)}
                  >
                    {busy === id ? t.common.loading : hasAccess ? t.billing.renew : t.billing.upgrade}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <ul className="mt-6 flex-1 space-y-3">
          {t.billing.pro.features.map((f) => (
            <li key={f} className="flex gap-3 text-sm">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-jade-soft text-jade-ink">
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">{t.billing.pro.comingSoon}</p>
      </article>
    </>
  );
}
