import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Dùng cho giám sát uptime / kiểm tra sau deploy. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, time: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
