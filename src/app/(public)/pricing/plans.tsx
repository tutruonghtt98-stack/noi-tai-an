"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { startCheckout } from "@/actions/billing";
import { useToast } from "@/components/ui/toast";
import { vnd } from "@/lib/billing";
import { cn } from "@/lib/cn";

type Cycle = "MONTHLY" | "YEARLY";
type Prices = { PRO: Record<Cycle, number>; TEAM: Record<Cycle, number> };

export function PricingPlans({
  signedIn,
  current,
  prices,
  teamMinSeats,
  saving,
  configured,
}: {
  signedIn: boolean;
  current: "FREE" | "PRO" | "TEAM" | null;
  prices: Prices;
  teamMinSeats: number;
  saving: { PRO: number; TEAM: number };
  configured: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [cycle, setCycle] = useState<Cycle>("YEARLY");
  const [seats, setSeats] = useState(teamMinSeats);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const buy = (plan: "PRO" | "TEAM") => {
    setBusy(plan);
    start(async () => {
      try {
        await startCheckout({ plan, cycle, seats });
      } catch (e) {
        // redirect() ném lỗi đặc biệt — chỉ báo lỗi thật
        if (!(e instanceof Error && e.message.includes("NEXT_REDIRECT"))) toast("error", t.common.error);
      } finally {
        setBusy(null);
      }
    });
  };

  const per = cycle === "MONTHLY" ? t.billing.perMonth : t.billing.perYear;

  const plans = [
    { id: "FREE" as const, info: t.billing.free, price: 0 },
    { id: "PRO" as const, info: t.billing.pro, price: prices.PRO[cycle] },
    { id: "TEAM" as const, info: t.billing.team, price: prices.TEAM[cycle] },
  ];

  return (
    <>
      <div className="mb-8 flex justify-center">
        <div className="segmented bg-surface shadow-card" role="group" aria-label={t.billing.title}>
          <button type="button" aria-pressed={cycle === "MONTHLY"} onClick={() => setCycle("MONTHLY")}>
            {t.billing.monthly}
          </button>
          <button type="button" aria-pressed={cycle === "YEARLY"} onClick={() => setCycle("YEARLY")}>
            {t.billing.yearly}
            <span className="rounded-full bg-jade-soft px-2 py-0.5 text-xs font-semibold text-jade-ink">{fmt(t.billing.save, { n: saving.PRO })}</span>
          </button>
        </div>
      </div>

      {!configured && <p className="mx-auto mb-6 max-w-xl rounded-2xl bg-rose-soft p-4 text-center text-sm text-rose-ink">{t.billing.notConfigured}</p>}

      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-3">
        {plans.map(({ id, info, price }) => {
          const featured = id === "PRO";
          const isCurrent = current === id;
          const total = id === "TEAM" ? price * Math.max(teamMinSeats, seats) : price;
          return (
            <article
              key={id}
              className={cn("card flex flex-col", featured && "relative ring-2 ring-ink lg:-my-3 lg:py-10")}
              aria-labelledby={`plan-${id}`}
            >
              {featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-bg">{t.billing.popular}</span>
              )}
              <h2 id={`plan-${id}`} className="text-xl font-semibold">
                {info.name}
              </h2>
              <p className="mt-1 min-h-12 text-sm text-ink-2">{info.desc}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="tabular text-4xl font-semibold tracking-tight">{price === 0 ? "0₫" : vnd(price)}</span>
                {price > 0 && (
                  <span className="text-sm text-muted">
                    {id === "TEAM" && t.billing.perSeat}
                    {per}
                  </span>
                )}
              </p>

              {id === "TEAM" && (
                <div className="mt-4 rounded-2xl bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium" id="seats-l">
                      {t.billing.seats}
                    </span>
                    <div className="flex items-center gap-1" role="group" aria-labelledby="seats-l">
                      <button type="button" className="icon-btn size-9 bg-surface" aria-label="-1" onClick={() => setSeats((s) => Math.max(teamMinSeats, s - 1))}>
                        <Minus className="size-4" aria-hidden />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        aria-labelledby="seats-l"
                        className="tabular h-9 w-14 rounded-lg bg-surface text-center font-semibold"
                        min={teamMinSeats}
                        max={200}
                        value={seats}
                        onChange={(e) => setSeats(Math.min(200, Math.max(1, Number(e.target.value) || teamMinSeats)))}
                      />
                      <button type="button" className="icon-btn size-9 bg-surface" aria-label="+1" onClick={() => setSeats((s) => Math.min(200, s + 1))}>
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="text-muted">{fmt(t.billing.minSeats, { n: teamMinSeats })}</span>
                    <span className="tabular font-semibold">
                      {t.billing.total}: {vnd(total)}
                    </span>
                  </p>
                </div>
              )}

              <ul className="mt-6 flex-1 space-y-3">
                {info.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-jade-soft text-jade-ink">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {id === "FREE" ? (
                  <Link href={signedIn ? "/dashboard" : "/login"} className="btn btn-soft w-full">
                    {isCurrent ? t.billing.current : signedIn ? t.nav.dashboard : t.auth.signIn}
                  </Link>
                ) : !signedIn ? (
                  <Link href="/login" className={cn("btn w-full", featured ? "btn-primary" : "btn-soft")}>
                    {t.billing.signInToBuy}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={cn("btn w-full", featured ? "btn-primary" : "btn-soft")}
                    disabled={!configured || pending}
                    onClick={() => buy(id)}
                  >
                    {busy === id ? t.common.loading : isCurrent ? t.billing.renew : t.billing.upgrade}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
