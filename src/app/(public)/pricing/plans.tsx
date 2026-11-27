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
  const [cycle, setCycle] = useState<Cycle>("YEARLY");
  const [pending, start] = useTransition();

  const buy = () => {
    start(async () => {
      try {
        await startCheckout({ plan: "PRO", cycle });
      } catch (e) {
        // redirect() ném lỗi đặc biệt — chỉ báo lỗi thật
        if (!(e instanceof Error && e.message.includes("NEXT_REDIRECT"))) toast("error", t.common.error);
      }
    });
  };

  const per = cycle === "MONTHLY" ? t.billing.perMonth : t.billing.perYear;
  const price = prices[cycle];

  return (
    <>
      <div className="mb-8 flex justify-center">
        <div className="segmented" role="group" aria-label={t.billing.title}>
          <button type="button" aria-pressed={cycle === "MONTHLY"} onClick={() => setCycle("MONTHLY")}>
            {t.billing.monthly}
          </button>
          <button type="button" aria-pressed={cycle === "YEARLY"} onClick={() => setCycle("YEARLY")}>
            {t.billing.yearly}
            <span className="rounded-full bg-jade-soft px-2 py-0.5 text-xs font-semibold text-jade-ink">{fmt(t.billing.save, { n: saving })}</span>
          </button>
        </div>
      </div>

      {!configured && <p className="mx-auto mb-6 max-w-xl rounded-2xl bg-rose-soft p-4 text-center text-sm text-rose-ink">{t.billing.notConfigured}</p>}

      <article className="card mx-auto flex max-w-md flex-col py-10" aria-labelledby="plan-pro">
        <h2 id="plan-pro" className="text-xl font-semibold">
          {t.billing.pro.name}
        </h2>
        <p className="mt-1 text-sm text-ink-2">{t.billing.pro.desc}</p>
        <p className="mt-5 flex items-baseline gap-1">
          <span className="tabular text-4xl font-semibold tracking-tight">{vnd(price)}</span>
          <span className="text-sm text-muted">{per}</span>
        </p>
        {!hasAccess && (
          <p className="mt-3 rounded-xl bg-ochre-soft px-4 py-2.5 text-sm text-ochre-ink">{t.billing.trialEndedNote}</p>
        )}

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

        <div className="mt-8">
          {!signedIn ? (
            <Link href="/login" className="btn btn-primary w-full">
              {t.billing.signInToBuy}
            </Link>
          ) : (
            <button type="button" className="btn btn-primary w-full" disabled={!configured || pending} onClick={buy}>
              {pending ? t.common.loading : hasAccess ? t.billing.renew : t.billing.upgrade}
            </button>
          )}
        </div>
      </article>
    </>
  );
}
