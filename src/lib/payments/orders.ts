import "server-only";
import { db } from "@/lib/db";
import { addCycle } from "@/lib/billing";
import { effectivePlan } from "@/lib/plan";

/**
 * Đánh dấu đơn đã thanh toán và kích hoạt/gia hạn gói. Idempotent:
 * webhook gửi lặp lại hoặc PayOS + trang return cùng gọi cũng chỉ kích hoạt một lần.
 */
export async function markOrderPaid(orderId: string, providerRef: string | null, amountPaid?: number) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { user: true } });
    if (!order) return { ok: false as const, reason: "NOT_FOUND" };
    if (order.status === "PAID") return { ok: true as const, already: true };
    if (amountPaid !== undefined && amountPaid < order.amount) return { ok: false as const, reason: "UNDERPAID" };

    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: { in: ["PENDING", "EXPIRED"] } },
      data: { status: "PAID", paidAt: new Date(), providerRef },
    });
    if (!claimed.count) return { ok: true as const, already: true };

    // Gia hạn nối tiếp nếu đang dùng đúng gói đó và còn hạn; ngược lại tính từ bây giờ.
    const u = order.user;
    const now = new Date();
    const sameActive = effectivePlan(u) === order.plan && u.planExpiresAt && u.planExpiresAt > now;
    const base = sameActive ? u.planExpiresAt! : now;
    await tx.user.update({
      where: { id: u.id },
      data: {
        plan: order.plan,
        planExpiresAt: addCycle(base, order.cycle),
        teamSeats: order.plan === "TEAM" ? order.seats : null,
      },
    });
    return { ok: true as const, already: false };
  });
}

/** Đơn chờ quá hạn → EXPIRED (gọi nhẹ nhàng khi đọc danh sách). */
export async function expireStaleOrders() {
  await db.order.updateMany({ where: { status: "PENDING", expiresAt: { lt: new Date() } }, data: { status: "EXPIRED" } });
}
