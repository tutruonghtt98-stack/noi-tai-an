import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Xuất toàn bộ dữ liệu cá nhân (quyền sở hữu dữ liệu của người dùng). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;
  const [user, goals, projects, tasks, habits, habitLogs, focusSessions, dailyPlans] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, locale: true, timezone: true, plan: true, createdAt: true },
    }),
    db.goal.findMany({ where: { userId } }),
    db.project.findMany({ where: { userId } }),
    db.task.findMany({ where: { userId } }),
    db.habit.findMany({ where: { userId } }),
    db.habitLog.findMany({ where: { userId } }),
    db.focusSession.findMany({ where: { userId } }),
    db.dailyPlan.findMany({ where: { userId } }),
  ]);
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), user, goals, projects, tasks, habits, habitLogs, focusSessions, dailyPlans },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="noi-tai-an-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
