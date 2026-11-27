import "server-only";
import { db } from "@/lib/db";

/** Dùng khi chưa có dòng AppSetting (lần đầu chạy, trước khi admin lưu lần nào). */
export const PRO_PRICE_DEFAULTS = { MONTHLY: 35_000, YEARLY: 350_000 };

/** Giá gói Pro hiện hành — admin chỉnh ở /admin/pricing, lưu trong bảng AppSetting. */
export async function getProPrices(): Promise<{ MONTHLY: number; YEARLY: number }> {
  const row = await db.appSetting.findUnique({ where: { id: 1 } });
  return {
    MONTHLY: row?.proPriceMonthly ?? PRO_PRICE_DEFAULTS.MONTHLY,
    YEARLY: row?.proPriceYearly ?? PRO_PRICE_DEFAULTS.YEARLY,
  };
}

export async function updateProPrices(monthly: number, yearly: number) {
  await db.appSetting.upsert({
    where: { id: 1 },
    create: { id: 1, proPriceMonthly: monthly, proPriceYearly: yearly },
    update: { proPriceMonthly: monthly, proPriceYearly: yearly },
  });
}

/** Tiết kiệm khi trả theo năm so với 12 tháng (%) */
export function yearlySavingFor(prices: { MONTHLY: number; YEARLY: number }) {
  return Math.round((1 - prices.YEARLY / (prices.MONTHLY * 12)) * 100);
}
