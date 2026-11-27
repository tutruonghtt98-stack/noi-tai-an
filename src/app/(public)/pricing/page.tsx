import type { Metadata } from "next";
import { Suspense } from "react";
import { getOptionalUser } from "@/lib/session";
import { dictionaries, getI18n } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { effectivePlan } from "@/lib/plan";
import { paymentConfigured, PRICES, TEAM_MIN_SEATS, yearlySaving } from "@/lib/billing";
import { PricingPlans } from "./plans";

export const metadata: Metadata = {
  title: "Bảng giá",
  description: "Gói Free, Pro và Team của Nội Tại Ẩn — thanh toán theo tháng hoặc theo năm qua VietQR.",
};

const saving = { PRO: yearlySaving("PRO"), TEAM: yearlySaving("TEAM") };

export default function PricingPage() {
  return (
    // Giá/gói thật phụ thuộc session (đã đăng nhập? gói hiện tại?) và ngôn ngữ
    // — tách riêng để phần khung trang còn lại prerender tĩnh thật. Fallback
    // dùng nội dung tiếng Việt, ẩn danh — đúng với tuyệt đại đa số khách.
    // paymentConfigured() KHÔNG được gọi ở module scope: nó chỉ đọc biến môi
    // trường, nên nếu đặt ngoài PricingContent, Cache Components sẽ coi đó là
    // "giá trị tĩnh" và đóng băng kết quả ngay lúc build — sai với biến môi
    // trường thật lúc chạy (đã từng gây lỗi "cổng thanh toán chưa cấu hình"
    // dù env đã set đúng). Phải tính bên trong phần phụ thuộc cookie/session.
    <Suspense fallback={<PricingBody t={dictionaries.vi.billing} signedIn={false} current={null} configured={false} />}>
      <PricingContent />
    </Suspense>
  );
}

async function PricingContent() {
  const [user, { t, locale }] = await Promise.all([getOptionalUser(), getI18n()]);
  const current = user ? effectivePlan(user) : null;
  const configured = paymentConfigured();
  return (
    // Ghi đè locale 'vi' tĩnh của root layout cho đúng người dùng thật (vd. đã
    // chọn 'en') — PricingPlans đọc useI18n() nên cần context khớp với t ở trên.
    <I18nProvider value={{ t, locale }}>
      <PricingBody t={t.billing} signedIn={!!user} current={current} configured={configured} />
    </I18nProvider>
  );
}

function PricingBody({
  t,
  signedIn,
  current,
  configured,
}: {
  t: (typeof dictionaries)["vi"]["billing"];
  signedIn: boolean;
  current: ReturnType<typeof effectivePlan> | null;
  configured: boolean;
}) {
  return (
    <>
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold sm:text-5xl">{t.title}</h1>
        <p className="mt-3 text-lg text-ink-2">{t.subtitle}</p>
      </div>
      <PricingPlans
        signedIn={signedIn}
        current={current}
        prices={PRICES}
        teamMinSeats={TEAM_MIN_SEATS}
        saving={saving}
        configured={configured}
      />
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
