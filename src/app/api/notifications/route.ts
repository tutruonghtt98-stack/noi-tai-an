import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Thông báo chưa đọc gần nhất — để trình duyệt hỏi định kỳ và phát âm thanh khi có thông báo mới. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ items: [] }, { status: 401 });
  const items = await db.notification.findMany({
    where: { userId: session.user.id, read: false },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, title: true, body: true, href: true, createdAt: true },
  });
  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
