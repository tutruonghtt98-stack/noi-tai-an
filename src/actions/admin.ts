"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { run, UserError } from "@/lib/action";
import { markOrderPaid } from "@/lib/payments/orders";

/** Cấp/đổi gói thủ công (tặng, xử lý khiếu nại, đối soát). months = 0 → về FREE. */
export async function adminSetPlan(userId: string, plan: "FREE" | "PRO" | "TEAM", months: number) {
  return run(async () => {
    await requireAdmin();
    const p = z.enum(["FREE", "PRO", "TEAM"]).parse(plan);
    const m = z.number().int().min(0).max(60).parse(months);
    const expires = new Date();
    expires.setMonth(expires.getMonth() + m);
    await db.user.update({
      where: { id: userId },
      data: p === "FREE" || m === 0 ? { plan: "FREE", planExpiresAt: null, teamSeats: null } : { plan: p, planExpiresAt: expires },
    });
    revalidatePath("/admin", "layout");
  });
}

export async function adminSetBanned(userId: string, banned: boolean) {
  return run(async () => {
    const admin = await requireAdmin();
    if (admin.id === userId) throw new UserError("SELF");
    await db.user.update({ where: { id: userId }, data: { bannedAt: banned ? new Date() : null } });
    revalidatePath("/admin", "layout");
  });
}

export async function adminSetRole(userId: string, role: "USER" | "ADMIN") {
  return run(async () => {
    const admin = await requireAdmin();
    if (admin.id === userId) throw new UserError("SELF");
    await db.user.update({ where: { id: userId }, data: { role: z.enum(["USER", "ADMIN"]).parse(role) } });
    revalidatePath("/admin", "layout");
  });
}

/** Đối soát thủ công: khách chuyển khoản sai nội dung nhưng đã nhận tiền. */
export async function adminMarkPaid(orderId: string, note: string) {
  return run(async () => {
    const admin = await requireAdmin();
    const ref = `MANUAL-${admin.email ?? admin.id}-${z.string().trim().max(80).parse(note) || Date.now()}`;
    const res = await markOrderPaid(orderId, ref);
    if (!res.ok) throw new UserError(res.reason ?? "ERROR");
    revalidatePath("/admin", "layout");
  });
}

export async function adminCancelOrder(orderId: string) {
  return run(async () => {
    await requireAdmin();
    await db.order.updateMany({ where: { id: orderId, status: { in: ["PENDING", "EXPIRED"] } }, data: { status: "CANCELLED" } });
    revalidatePath("/admin", "layout");
  });
}
