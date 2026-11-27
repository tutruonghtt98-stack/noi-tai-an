import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getProPrices } from "@/lib/pricing";
import { PricingForm } from "./form";

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = { title: "Giá gói" };

export default async function AdminPricingPage() {
  await requireAdmin();
  const prices = await getProPrices();

  return (
    <section className="card max-w-lg">
      <h2 className="card-title mb-1">Giá gói Pro</h2>
      <p className="mb-6 text-sm text-ink-2">Áp dụng ngay cho trang /pricing và mọi đơn hàng mới tạo từ lúc lưu. Không ảnh hưởng đơn đã thanh toán trước đó.</p>
      <PricingForm initial={prices} />
    </section>
  );
}
