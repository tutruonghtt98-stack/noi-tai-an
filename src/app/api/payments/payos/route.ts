import { db } from "@/lib/db";
import { verifyWebhook } from "@/lib/payments/payos";
import { markOrderPaid } from "@/lib/payments/orders";

export const dynamic = "force-dynamic";

/**
 * Webhook PayOS. Đăng ký URL này trong my.payos.vn → Kênh thanh toán → Webhook:
 *   https://ten-mien.vn/api/payments/payos
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !verifyWebhook(body)) return Response.json({ error: "invalid signature" }, { status: 400 });

  const data = body.data as { orderCode: number; amount: number; code: string; reference?: string };
  // PayOS gửi một webhook thử khi đăng ký — trả 200 để xác nhận.
  if (body.code !== "00" || data.code !== "00") return Response.json({ ok: true });

  const order = await db.order.findUnique({ where: { orderCode: Number(data.orderCode) } });
  if (!order) return Response.json({ ok: true, note: "unknown order" });

  const res = await markOrderPaid(order.id, data.reference ?? null, Number(data.amount));
  return Response.json({ ok: res.ok });
}
