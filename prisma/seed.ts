/**
 * Dữ liệu mẫu cho môi trường local: `npm run db:seed`
 * Tạo tài khoản demo (demo@noitaian.local) với mục tiêu, thói quen 45 ngày lịch sử,
 * nhiệm vụ hôm nay và các phiên tập trung. Chạy lại sẽ xoá và tạo mới dữ liệu demo.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const TZ = "Asia/Ho_Chi_Minh";
const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const dbDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
const addDays = (s: string, n: number) => {
  const d = dbDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Không chạy seed trên production.");
  const today = iso(new Date());
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const quarter = Math.ceil(month / 3);

  const email = "demo@noitaian.local";
  await db.user.deleteMany({ where: { email } });
  const user = await db.user.create({
    data: { email, name: "Minh An", role: "ADMIN", plan: "PRO", createdAt: dbDate(addDays(today, -60)) },
  });
  const uid = user.id;

  // Mục tiêu: Năm → Quý → Tháng
  const read = await db.goal.create({
    data: { userId: uid, title: "Đọc 24 cuốn sách", why: "Mở rộng góc nhìn và giữ đầu óc minh mẫn mỗi ngày.", horizon: "YEAR", year, targetValue: 24, currentValue: 17, unit: "cuốn", color: "ochre" },
  });
  const health = await db.goal.create({
    data: { userId: uid, title: "Chạy bán marathon 21km", why: "Chứng minh với bản thân rằng kỷ luật thắng cảm hứng.", horizon: "YEAR", year, color: "jade" },
  });
  const career = await db.goal.create({
    data: { userId: uid, title: "Ra mắt sản phẩm cá nhân", why: "Tự do sáng tạo và thu nhập độc lập.", horizon: "YEAR", year, color: "mist" },
  });
  const q = await db.goal.create({
    data: { userId: uid, title: "Chạy liền 15km không nghỉ", horizon: "QUARTER", year, quarter, parentId: health.id, targetValue: 15, currentValue: 11, unit: "km", color: "jade" },
  });
  await db.goal.create({
    data: { userId: uid, title: "Tổng 80km trong tháng", horizon: "MONTH", year, quarter, month, parentId: q.id, targetValue: 80, currentValue: 46, unit: "km", color: "jade" },
  });
  const mvp = await db.goal.create({
    data: { userId: uid, title: "Hoàn thiện MVP và 10 người dùng thử", horizon: "QUARTER", year, quarter, parentId: career.id, color: "mist" },
  });

  const project = await db.project.create({ data: { userId: uid, goalId: mvp.id, title: "Thiết kế & xây dựng MVP" } });
  const actions = ["Phỏng vấn 5 người dùng tiềm năng", "Vẽ wireframe luồng chính", "Dựng landing page", "Tích hợp thanh toán", "Viết tài liệu hướng dẫn"];
  for (const [i, title] of actions.entries()) {
    await db.task.create({
      data: { userId: uid, goalId: mvp.id, projectId: project.id, title, status: i < 2 ? "DONE" : "TODO", completedAt: i < 2 ? new Date() : null },
    });
  }
  await db.task.create({ data: { userId: uid, goalId: read.id, title: "Chọn 3 cuốn cho tháng tới" } });

  // Nhiệm vụ hôm nay (có giờ để hiện trên timeline)
  const todayTasks = [
    { title: "Viết 1.000 từ cho chương 3", startTime: "08:30", estimateMin: 90, priority: 1, goalId: career.id, done: true },
    { title: "Review phản hồi người dùng thử", startTime: "10:30", estimateMin: 60, priority: 2, goalId: mvp.id, done: false },
    { title: "Chạy 8km nhịp nhẹ", startTime: "17:00", estimateMin: 50, priority: 3, goalId: health.id, done: false },
    { title: "Wireframe: màn hình thanh toán", startTime: "13:00", estimateMin: 120, goalId: mvp.id, done: false },
    { title: "Trả lời email quan trọng", startTime: "11:30", estimateMin: 30, done: false },
    { title: "Đọc 30 trang sách", goalId: read.id, done: false },
  ];
  for (const [i, t] of todayTasks.entries()) {
    await db.task.create({
      data: {
        userId: uid,
        title: t.title,
        date: dbDate(today),
        startTime: t.startTime,
        estimateMin: t.estimateMin,
        priority: t.priority ?? null,
        goalId: t.goalId ?? null,
        status: t.done ? "DONE" : "TODO",
        completedAt: t.done ? new Date() : null,
        sortOrder: i,
      },
    });
  }
  await db.task.create({ data: { userId: uid, title: "Lên dàn ý bài viết tuần", date: dbDate(addDays(today, -2)) } });
  await db.dailyPlan.create({ data: { userId: uid, date: dbDate(today), intention: "Hoàn thành wireframe thanh toán trước 15:00 và giữ nhịp chạy.", energy: 4 } });

  // Thói quen + 45 ngày lịch sử
  type SeedHabit = { name: string; icon: string; color: string; goalId: string | null; rate: number; days: number[]; target?: number };
  const habits: SeedHabit[] = [
    { name: "Đọc sách 20 phút", icon: "book", color: "ochre", goalId: read.id, rate: 0.9, days: [] },
    { name: "Chạy bộ / vận động", icon: "walk", color: "jade", goalId: health.id, rate: 0.75, days: [1, 3, 5, 6] },
    { name: "Thiền 10 phút", icon: "brain", color: "mist", goalId: null, rate: 0.8, days: [] },
    { name: "Uống đủ 8 ly nước", icon: "water", color: "mist", goalId: null, rate: 0.7, days: [], target: 8 },
    { name: "Viết nhật ký tối", icon: "pen", color: "rose", goalId: null, rate: 0.6, days: [] },
  ];
  let seedRand = 42;
  const rand = () => ((seedRand = (seedRand * 16807) % 2147483647) / 2147483647);
  for (const [i, h] of habits.entries()) {
    const habit = await db.habit.create({
      data: {
        userId: uid,
        name: h.name,
        icon: h.icon,
        color: h.color,
        goalId: h.goalId,
        daysOfWeek: h.days,
        targetPerDay: h.target ?? 1,
        sortOrder: i,
        createdAt: dbDate(addDays(today, -45)),
      },
    });
    for (let d = 45; d >= 1; d--) {
      const day = addDays(today, -d);
      const dow = dbDate(day).getUTCDay();
      if (h.days.length && !h.days.includes(dow)) continue;
      // Chuỗi gần đây liền mạch hơn để demo streak
      if (d <= 9 || rand() < h.rate) {
        await db.habitLog.create({ data: { habitId: habit.id, userId: uid, date: dbDate(day), count: h.target ?? 1 } });
      }
    }
    if (i === 0 || i === 2) await db.habitLog.create({ data: { habitId: habit.id, userId: uid, date: dbDate(today), count: 1 } });
    if (i === 3) await db.habitLog.create({ data: { habitId: habit.id, userId: uid, date: dbDate(today), count: 5 } });
  }

  // Phiên tập trung trong tháng
  for (let d = 20; d >= 0; d--) {
    const day = addDays(today, -d);
    const n = d === 0 ? 2 : Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) {
      await db.focusSession.create({
        data: { userId: uid, plannedMinutes: 25, actualMinutes: 25, completed: true, date: dbDate(day), startedAt: new Date(`${day}T0${2 + k}:00:00Z`) },
      });
    }
    // Ưu tiên quá khứ để lịch kỷ luật có màu
    if (d > 0) {
      const done = rand() < 0.7;
      await db.task.create({
        data: { userId: uid, title: "Ưu tiên chính trong ngày", date: dbDate(day), priority: 1, status: done ? "DONE" : "TODO", completedAt: done ? new Date() : null },
      });
    }
  }

  // Nhật ký & đánh giá tuần
  const causes = ["distraction", "too_big", "fatigue", "unclear", "perfectionism", "distraction", "fear"];
  for (let d = 14; d >= 1; d--) {
    const c1 = causes[Math.floor(rand() * causes.length)]!;
    const c2 = rand() < 0.4 ? "distraction" : null;
    await db.journalEntry.create({
      data: {
        userId: uid,
        date: dbDate(addDays(today, -d)),
        mood: 2 + Math.floor(rand() * 4),
        wins: "Hoàn thành phiên tập trung buổi sáng đúng giờ.",
        lessons: "Lướt điện thoại quá lâu sau bữa trưa.",
        tomorrow: d % 3 === 0 ? "Để điện thoại ở phòng khác trong phiên 9h." : null,
        procrastination: rand() < 0.75 ? [...new Set([c1, ...(c2 ? [c2] : [])])] : [],
      },
    });
  }
  const lastWeek = (() => {
    const dow = (dbDate(today).getUTCDay() + 6) % 7;
    return addDays(today, -dow - 7);
  })();
  await db.weeklyReview.create({
    data: {
      userId: uid,
      weekStart: dbDate(lastWeek),
      rating: 7,
      highlights: "Giữ chuỗi đọc sách 7/7 ngày, chạy được 11km.",
      obstacles: "Buổi chiều hay mất tập trung.",
      rootCause: "Ngủ muộn → buổi chiều thiếu năng lượng.",
      experiment: "Đi ngủ trước 23h trong 7 ngày.",
      nextFocus: ["1. Wireframe thanh toán", "2. Chạy 3 buổi", "3. Đọc 2 cuốn"].join("\n"),
    },
  });

  console.log(`✔ Seed xong cho ${email} (${today})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
