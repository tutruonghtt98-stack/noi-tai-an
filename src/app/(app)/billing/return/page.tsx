import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { getPaymentStatus } from "@/lib/payments/payos";
import { markOrderPaid } from "@/lib/payments/orders";

/**
 * PayOS chuyển người dùng về đây sau khi thanh toán/huỷ.
 * Không tin tham số trên URL — luôn tra lại trạng thái từ PayOS (dự phòng khi webhook chậm).
 */
export default async function BillingReturn({ searchParams }: { searchParams: Promise<{ code?: string; cancel?: string }> }) {
  const user = await requireUser();
  const { code } = await searchParams;
  const order = code ? await db.order.findFirst({ where: { code, userId: user.id } }) : null;
  if (!order) redirect("/billing");

  if (order.status === "PENDING" && order.provider === "payos") {
    const status = await getPaymentStatus(order.orderCode).catch(() => null);
    if (status?.status === "PAID") await markOrderPaid(order.id, status.id, status.amountPaid);
    else if (status?.status === "CANCELLED") await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  }
  redirect(`/billing/checkout/${order.code}`);
}
