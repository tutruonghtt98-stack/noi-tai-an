import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Tài liệu: https://payos.vn/docs/api/
const API = "https://api-merchant.payos.vn";

const env = () => ({
  clientId: process.env.PAYOS_CLIENT_ID!,
  apiKey: process.env.PAYOS_API_KEY!,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY!,
});

const hmac = (data: string) => createHmac("sha256", env().checksumKey).update(data).digest("hex");

/** Chữ ký webhook: các trường của data sắp theo khoá, nối "k=v&k=v". */
export function signData(data: Record<string, unknown>) {
  const str = Object.keys(data)
    .sort()
    .map((k) => {
      const v = data[k];
      const val = v === null || v === undefined || v === "undefined" || v === "null" ? "" : Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${k}=${val}`;
    })
    .join("&");
  return hmac(str);
}

export function verifyWebhook(body: { data?: Record<string, unknown>; signature?: string }) {
  if (!body?.data || typeof body.signature !== "string") return false;
  const expected = Buffer.from(signData(body.data));
  const got = Buffer.from(body.signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export async function createPaymentLink(input: {
  orderCode: number;
  amount: number;
  description: string; // tối đa 25 ký tự
  returnUrl: string;
  cancelUrl: string;
  buyerEmail?: string | null;
  expiredAt: number; // unix seconds
}) {
  const { clientId, apiKey } = env();
  const description = input.description.slice(0, 25);
  const signature = hmac(
    `amount=${input.amount}&cancelUrl=${input.cancelUrl}&description=${description}&orderCode=${input.orderCode}&returnUrl=${input.returnUrl}`,
  );
  const res = await fetch(`${API}/v2/payment-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-id": clientId, "x-api-key": apiKey },
    body: JSON.stringify({ ...input, description, buyerEmail: input.buyerEmail ?? undefined, signature }),
    cache: "no-store",
  });
  const json = (await res.json()) as { code: string; desc: string; data?: { checkoutUrl: string; paymentLinkId: string } };
  if (json.code !== "00" || !json.data) throw new Error(`PAYOS_${json.code}: ${json.desc}`);
  return json.data;
}

/** Tra cứu trạng thái (dự phòng khi webhook đến chậm). */
export async function getPaymentStatus(orderCode: number) {
  const { clientId, apiKey } = env();
  const res = await fetch(`${API}/v2/payment-requests/${orderCode}`, {
    headers: { "x-client-id": clientId, "x-api-key": apiKey },
    cache: "no-store",
  });
  const json = (await res.json()) as { code: string; data?: { status: string; amountPaid: number; id: string } };
  return json.code === "00" ? json.data ?? null : null;
}
