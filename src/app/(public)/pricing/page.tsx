import type { Metadata } from "next";
import { Suspense } from "react";
import { getOptionalUser } from "@/lib/session";
import { dictionaries, getI18n } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { hasActiveAccess } from "@/lib/plan";
import { paymentConfigured } from "@/lib/billing";
import { getProPrices, yearlySavingFor, PRO_PRICE_DEFAULTS } from "@/lib/pricing";
import { PricingPlans } from "./plans";

export const metadata: Metadata = {
  title: "Bảng giá",
  description: "Gói Pro của Nội Tại Ẩn — thanh toán theo tháng hoặc theo năm qua VietQR.",
};

export default function PricingPage() {
  return (
    // Giá/gói thật phụ thuộc session (đã đăng nhập? còn quyền dùng không?) và
    // ngôn ngữ — tách riêng để phần khung trang còn lại prerender tĩnh thật.
    // Fallback dùng giá mặc định + ẩn danh, đúng với tuyệt đại đa số khách.
    // paymentConfigured()/getProPrices() KHÔNG được gọi ở module scope: Cache
    // Components sẽ đóng băng kết quả ngay lúc build (đã từng gây lỗi "cổng
    // thanh toán chưa cấu hình" dù env đã set đúng) — phải tính trong phần
    // phụ thuộc cookie/session.
    <Suspense
      fallback={
        <PricingBody
          t={dictionaries.vi.billing}
          signedIn={false}
          hasAccess={false}
          prices={PRO_PRICE_DEFAULTS}
          configured={false}
        />
      }
    >
      <PricingContent />
    </Suspense>
  );
}

async function PricingContent() {
  const [user, { t, locale }, prices] = await Promise.all([getOptionalUser(), getI18n(), getProPrices()]);
  const configured = paymentConfigured();
  return (
    // Ghi đè locale 'vi' tĩnh của root layout cho đúng người dùng thật (vd. đã
    // chọn 'en') — PricingPlans đọc useI18n() nên cần context khớp với t ở trên.
    <I18nProvider value={{ t, locale }}>
      <PricingBody
        t={t.billing}
        signedIn={!!user}
        hasAccess={user ? hasActiveAccess(user) : false}
        prices={prices}
        configured={configured}
      />
    </I18nProvider>
  );
}

function PricingBody({
  t,
  signedIn,
  hasAccess,
  prices,
  configured,
}: {
  t: (typeof dictionaries)["vi"]["billing"];
  signedIn: boolean;
  hasAccess: boolean;
  prices: { MONTHLY: number; YEARLY: number };
  configured: boolean;
}) {
  return (
    <>
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t.title}</h1>
        <p className="mt-3 text-lg text-ink-2">{t.subtitle}</p>
      </div>
      <PricingPlans signedIn={signedIn} hasAccess={hasAccess} prices={prices} saving={yearlySavingFor(prices)} configured={configured} />
      <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="faq">
        <h2 id="faq" className="mb-5 text-2xl font-semibold">
          {t.faq}
        </h2>
        <div className="space-y-3">
          {t.faqs.map(([q, a]) => (
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
