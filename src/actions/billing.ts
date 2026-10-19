"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import {
  activeProvider,
  ORDER_TTL_MIN,
  orderCodeNumber,
  orderCodeString,
  priceFor,
  TEAM_MAX_SEATS,
  TEAM_MIN_SEATS,
} from "@/lib/billing";
import { createPaymentLink } from "@/lib/payments/payos";
import { markOrderPaid } from "@/lib/payments/orders";

const schema = z.object({
  plan: z.enum(["PRO", "TEAM"]),
  cycle: z.enum(["MONTHLY", "YEARLY"]),
  seats: z.coerce.number().int().min(1).max(TEAM_MAX_SEATS).default(1),
});

async function baseUrl() {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/** Tạo đơn hàng rồi chuyển tới cổng thanh toán (PayOS) hoặc trang QR (SePay / giả lập). */
export async function startCheckout(input: z.input<typeof schema>) {
  const user = await requireUser();
  const d = schema.parse(input);
  const seats = d.plan === "TEAM" ? Math.max(TEAM_MIN_SEATS, d.seats) : 1;
  const amount = priceFor(d.plan, d.cycle, seats);
  const provider = activeProvider();
  const code = orderCodeString();
  const expiresAt = new Date(Date.now() + ORDER_TTL_MIN * 60_000);

  const order = await db.order.create({
    data: { code, orderCode: orderCodeNumber(), userId: user.id, plan: d.plan, cycle: d.cycle, seats, amount, provider, expiresAt },
  });

  if (provider === "payos") {
    const url = await baseUrl();
    const link = await createPaymentLink({
      orderCode: order.orderCode,
      amount,
      description: code,
      returnUrl: `${url}/billing/return?code=${code}`,
      cancelUrl: `${url}/billing/return?code=${code}&cancel=1`,
      buyerEmail: user.email,
      expiredAt: Math.floor(expiresAt.getTime() / 1000),
    });
    await db.order.update({ where: { id: order.id }, data: { checkoutUrl: link.checkoutUrl, providerRef: link.paymentLinkId } });
    redirect(link.checkoutUrl);
  }
  redirect(`/billing/checkout/${code}`);
}

export async function cancelOrder(code: string) {
  return run(async () => {
    const user = await requireUser();
    await db.order.updateMany({ where: { code, userId: user.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  });
}

/** Trạng thái đơn — trang QR hỏi định kỳ để tự chuyển khi đã nhận tiền. */
export async function orderStatus(code: string) {
  const user = await requireUser();
  const o = await db.order.findFirst({ where: { code, userId: user.id }, select: { status: true, expiresAt: true } });
  if (!o) return "NOT_FOUND";
  if (o.status === "PENDING" && o.expiresAt < new Date()) return "EXPIRED";
  return o.status;
}

/** Chỉ môi trường phát triển: giả lập ngân hàng báo đã nhận tiền. */
export async function simulatePayment(code: string) {
  return run(async () => {
    if (process.env.NODE_ENV === "production") throw new UserError("FORBIDDEN");
    const user = await requireUser();
    const o = await db.order.findFirst({ where: { code, userId: user.id, provider: "mock" } });
    if (!o) throw new UserError("NOT_FOUND");
    await markOrderPaid(o.id, `MOCK-${Date.now()}`, o.amount);
  });
}
