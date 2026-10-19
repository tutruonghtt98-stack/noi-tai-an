import type { BillingCycle, Plan } from "@prisma/client";

/** Bảng giá (VND). Đổi giá tại đây — mọi trang và cổng thanh toán đọc từ đây. */
export const PRICES = {
  PRO: { MONTHLY: 99_000, YEARLY: 990_000 },
  TEAM: { MONTHLY: 79_000, YEARLY: 790_000 }, // mỗi chỗ
} as const;

export const TEAM_MIN_SEATS = 3;
export const TEAM_MAX_SEATS = 200;
export const ORDER_TTL_MIN = 30;

export type PaidPlan = Exclude<Plan, "FREE">;

export function priceFor(plan: PaidPlan, cycle: BillingCycle, seats = 1) {
  const unit = PRICES[plan][cycle];
  return plan === "TEAM" ? unit * Math.max(TEAM_MIN_SEATS, seats) : unit;
}

/** Tiết kiệm khi trả theo năm so với 12 tháng (%) */
export function yearlySaving(plan: PaidPlan) {
  const p = PRICES[plan];
  return Math.round((1 - p.YEARLY / (p.MONTHLY * 12)) * 100);
}

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
