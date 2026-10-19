import type { Metadata } from "next";
import { getOptionalUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { effectivePlan } from "@/lib/plan";
import { paymentConfigured, PRICES, TEAM_MIN_SEATS, yearlySaving } from "@/lib/billing";
import { PricingPlans } from "./plans";

export const metadata: Metadata = {
  title: "Bảng giá",
  description: "Gói Free, Pro và Team của Nội Tại Ẩn — thanh toán theo tháng hoặc theo năm qua VietQR.",
};

export default async function PricingPage() {
  const [user, { t }] = await Promise.all([getOptionalUser(), getI18n()]);
  const current = user ? effectivePlan(user) : null;

  return (
    <>
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t.billing.title}</h1>
        <p className="mt-3 text-lg text-ink-2">{t.billing.subtitle}</p>
      </div>
      <PricingPlans
        signedIn={!!user}
        current={current}
        prices={PRICES}
        teamMinSeats={TEAM_MIN_SEATS}
        saving={{ PRO: yearlySaving("PRO"), TEAM: yearlySaving("TEAM") }}
        configured={paymentConfigured()}
      />
      <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="faq">
        <h2 id="faq" className="mb-5 text-2xl font-semibold">
          {t.billing.faq}
        </h2>
        <div className="space-y-3">
          {t.billing.faqs.map(([q, a]) => (
            <details key={q} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {q}
                <span aria-hidden className="text-xl text-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
