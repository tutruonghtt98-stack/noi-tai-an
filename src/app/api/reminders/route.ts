import { auth } from "@/auth";
import { db } from "@/lib/db";
import { toDbDate, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Lịch trình hôm nay (việc có giờ bắt đầu, chưa xong) — để trình duyệt hẹn giờ nhắc. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ tasks: [] }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { timezone: true, bannedAt: true } });
  if (!user || user.bannedAt) return Response.json({ tasks: [] }, { status: 401 });
  const today = todayISO(user.timezone);
  const tasks = await db.task.findMany({
    where: { userId: session.user.id, date: toDbDate(today), status: "TODO", startTime: { not: null } },
    select: { id: true, title: true, startTime: true, estimateMin: true },
    orderBy: { startTime: "asc" },
  });
  return Response.json({ timezone: user.timezone, today, tasks }, { headers: { "Cache-Control": "no-store" } });
}
