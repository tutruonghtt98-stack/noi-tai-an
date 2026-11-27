import type { Plan, BillingCycle } from "@/generated/prisma/client";

// Giá gói Pro không còn tĩnh — đọc qua getProPrices() trong "@/lib/pricing"
// (admin chỉnh ở /admin/pricing). Gói Team đã ngừng bán (bỏ Free/Team khỏi
// trang Pricing), chỉ còn Pro theo tháng/năm; Plan vẫn giữ TEAM trong enum để
// không phá dữ liệu lịch sử của khách đã từng mua Team trước đây.

export const ORDER_TTL_MIN = 30;

export type PaidPlan = Exclude<Plan, "FREE">;

export function addCycle(from: Date, cycle: BillingCycle) {
  const d = new Date(from);
  if (cycle === "MONTHLY") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

export const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "₫";

/** Mã nội dung chuyển khoản: NTA + 6 ký tự (không có ký tự dễ nhầm). */
export function orderCodeString() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "NTA";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}

/** Mã số đơn cho PayOS — vừa INT 32-bit của Postgres (< 2.147.483.647). */
export function orderCodeNumber() {
  return (Math.floor(Date.now() / 1000) % 20_000_000) * 100 + Math.floor(Math.random() * 100);
}

export type PaymentProvider = "payos" | "sepay" | "mock";

export function activeProvider(): PaymentProvider {
  const p = process.env.PAYMENT_PROVIDER;
  if (p === "payos" && process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY) return "payos";
  if (p === "sepay" && process.env.SEPAY_ACCOUNT_NO && process.env.SEPAY_BANK) return "sepay";
  // Giả lập chỉ được phép ngoài production
  if (process.env.NODE_ENV !== "production") return "mock";
  throw new Error("PAYMENT_NOT_CONFIGURED");
}

export function paymentConfigured() {
  try {
    activeProvider();
    return true;
  } catch {
    return false;
  }
}
