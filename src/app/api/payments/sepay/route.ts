import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { markOrderPaid } from "@/lib/payments/orders";

export const dynamic = "force-dynamic";

type SepayHook = {
  id: number;
  gateway: string;
  transferType: "in" | "out";
  transferAmount: number;
  content: string;
  code?: string | null;
  referenceCode?: string;
};

function authorized(req: Request) {
  const key = process.env.SEPAY_API_KEY;
  if (!key) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Apikey ${key}`);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * Webhook SePay. Trong my.sepay.vn → Webhooks: URL https://ten-mien.vn/api/payments/sepay,
 * kiểu chứng thực "API Key", điền SEPAY_API_KEY.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ success: false }, { status: 401 });
  const hook = (await req.json().catch(() => null)) as SepayHook | null;
  if (!hook || hook.transferType !== "in") return Response.json({ success: true });

  const code = (hook.code ?? hook.content ?? "").toUpperCase().match(/NTA[A-Z0-9]{6}/)?.[0];
  if (!code) return Response.json({ success: true, note: "no order code" });

  const order = await db.order.findUnique({ where: { code } });
  if (!order) return Response.json({ success: true, note: "unknown order" });

  const res = await markOrderPaid(order.id, `SEPAY-${hook.id}`, Number(hook.transferAmount));
  return Response.json({ success: res.ok });
}
