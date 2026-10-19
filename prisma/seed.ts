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

  // ---------- Cộng đồng ----------
  await db.user.update({ where: { id: uid }, data: { username: "minhan", bio: "Đang xây thói quen đọc sách & chạy bộ mỗi ngày.", profilePublic: true } });
  const friendsData = [
    { email: "lan@demo.local", name: "Ngọc Lan", username: "ngoclan" },
    { email: "huy@demo.local", name: "Quang Huy", username: "quanghuy" },
    { email: "thao@demo.local", name: "Phương Thảo", username: "phuongthao" },
    { email: "khoa@demo.local", name: "Đăng Khoa", username: "dangkhoa" },
  ];
  await db.user.deleteMany({ where: { email: { in: friendsData.map((f) => f.email) } } });
  const friends = [];
  for (const f of friendsData) {
    friends.push(await db.user.create({ data: { ...f, profilePublic: true, createdAt: dbDate(addDays(today, -40)) } }));
  }
  // Hoạt động để bảng xếp hạng có dữ liệu
  for (const [i, f] of friends.entries()) {
    const h = await db.habit.create({ data: { userId: f.id, name: "Đọc sách", createdAt: dbDate(addDays(today, -30)) } });
    for (let d = 0; d < 7; d++) {
      if (rand() < 0.55 + i * 0.1) await db.habitLog.create({ data: { habitId: h.id, userId: f.id, date: dbDate(addDays(today, -d)), count: 1 } });
      if (rand() < 0.5) await db.focusSession.create({ data: { userId: f.id, plannedMinutes: 25, actualMinutes: 25, completed: true, date: dbDate(addDays(today, -d)), startedAt: new Date() } });
    }
  }

  const posts = [
    { u: friends[0]!, cat: "READING", text: "Xong cuốn “Atomic Habits” sau 3 tuần, mỗi tối 20 trang. Bài học lớn nhất: thiết kế môi trường quan trọng hơn ý chí." },
    { u: friends[1]!, cat: "WORKOUT", text: "Ngày 12/21 thử thách chạy bộ. Hôm nay mưa nhưng vẫn chạy 5km trên máy. Không phá chuỗi!" },
    { u: user, cat: "FOCUS", text: "4 phiên Pomodoro liền mạch buổi sáng, xong wireframe thanh toán sớm hơn kế hoạch. Tắt điện thoại thật sự hiệu quả." },
    { u: friends[2]!, cat: "STUDY", text: "Học IELTS Listening 45 phút. Tuần này tăng từ 6.0 lên 6.5 ở bài thi thử." },
    { u: friends[3]!, cat: "GOAL", text: "Hoàn thành mục tiêu quý: tiết kiệm 20 triệu. Cảm ơn nhóm đồng hành đã nhắc mình mỗi tuần" },
  ];
  const created = [];
  for (const [i, p] of posts.entries()) {
    created.push(
      await db.post.create({
        data: { userId: p.u.id, category: p.cat as "READING", content: p.text, createdAt: new Date(Date.now() - (i + 1) * 2.7 * 3600_000) },
      }),
    );
  }
  for (const p of created) {
    for (const f of [user, ...friends]) {
      if (f.id !== p.userId && rand() < 0.6) {
        await db.cheer.create({ data: { postId: p.id, userId: f.id } });
        await db.post.update({ where: { id: p.id }, data: { cheerCount: { increment: 1 } } });
      }
    }
  }
  await db.comment.create({ data: { postId: created[1]!.id, userId: uid, content: "Đỉnh quá! Mình cũng đang ở ngày 9, cố lên nhé." } });
  await db.post.update({ where: { id: created[1]!.id }, data: { commentCount: 1 } });

  // Thử thách chính thức đang diễn ra + thử thách sắp tới
  const ch = await db.challenge.create({
    data: {
      creatorId: uid,
      title: "21 ngày đọc sách 20 phút",
      description: "Mỗi ngày đọc tối thiểu 20 phút, check-in kèm một câu tâm đắc. Hoàn thành ≥ 17/21 ngày để nhận huy hiệu.",
      category: "READING",
      durationDays: 21,
      startDate: dbDate(addDays(today, -8)),
      official: true,
      badgeName: "Mọt sách 21 ngày",
    },
  });
  for (const f of [user, ...friends]) {
    await db.challengeMember.create({ data: { challengeId: ch.id, userId: f.id } });
    for (let d = 1; d <= 8; d++) {
      if (f.id === uid ? d !== 4 : rand() < 0.7) await db.challengeCheckin.create({ data: { challengeId: ch.id, userId: f.id, date: dbDate(addDays(today, -d)) } });
    }
  }
  await db.post.create({ data: { userId: friends[0]!.id, kind: "CHECKIN", category: "READING", challengeId: ch.id, content: "“Bạn không vươn lên tầm mục tiêu, bạn rơi xuống tầm hệ thống của mình.”" } });
  await db.challenge.create({
    data: { creatorId: friends[1]!.id, title: "7 ngày dậy trước 6h", description: "Check-in ảnh bình minh hoặc đồng hồ.", category: "OTHER", durationDays: 7, startDate: dbDate(addDays(today, 2)) },
  });

  // Nhóm đồng hành (xoá nhóm demo của lần seed trước — nhóm không bị xoá theo người dùng)
  await db.group.deleteMany({ where: { inviteCode: { startsWith: "demo" } } });
  const weekStartIso = addDays(today, -((dbDate(today).getUTCDay() + 6) % 7));
  const group = await db.group.create({
    data: {
      name: "Hội dậy sớm & đọc sách",
      description: "Cam kết mỗi tuần, cập nhật tiến độ, tổng kết vào Chủ nhật.",
      ownerId: uid,
      inviteCode: "demo" + Math.floor(rand() * 1e6),
      maxMembers: 6,
      members: {
        create: [
          { userId: uid, role: "OWNER", commitment: "Đọc 100 trang và chạy 3 buổi", commitmentWeek: dbDate(weekStartIso) },
          { userId: friends[0]!.id, commitment: "Thiền 10 phút mỗi sáng", commitmentWeek: dbDate(weekStartIso) },
          { userId: friends[2]!.id },
        ],
      },
    },
  });
  await db.post.create({ data: { userId: friends[0]!.id, groupId: group.id, category: "OTHER", content: "Hôm nay mình thiền được 12 phút, tâm trí nhẹ hơn hẳn. Mọi người thế nào rồi?" } });

  // Nhóm công khai có vị trí (để thử Gợi ý / Tìm nhóm gần tôi)
  await db.group.update({ where: { id: group.id }, data: { isPublic: true, category: "READING", city: "Quận 1, TP.HCM", lat: 10.78, lng: 106.7 } });
  const publicGroups = [
    { owner: friends[1]!, name: "Chạy bộ Thảo Cầm Viên 5h30", description: "Chạy 5km mỗi sáng quanh Thảo Cầm Viên, check-in trước 7h.", category: "WORKOUT", city: "Quận 1, TP.HCM", lat: 10.79, lng: 106.71, max: 8 },
    { owner: friends[2]!, name: "IELTS 7.0 trong 6 tháng", description: "Học 2 giờ mỗi ngày, cùng ôn Listening & Speaking cuối tuần.", category: "STUDY", city: "Bình Thạnh, TP.HCM", lat: 10.81, lng: 106.71, max: 10 },
    { owner: friends[3]!, name: "Deep Work Thủ Đức", description: "4 phiên Pomodoro mỗi sáng, không mạng xã hội trước 11h.", category: "FOCUS", city: "Thủ Đức, TP.HCM", lat: 10.85, lng: 106.77, max: 6 },
    { owner: friends[0]!, name: "CLB Đọc sách Hồ Gươm", description: "Mỗi tháng 2 cuốn, gặp mặt chủ nhật cuối tháng.", category: "READING", city: "Hoàn Kiếm, Hà Nội", lat: 21.03, lng: 105.85, max: 10 },
  ];
  for (const [i, g] of publicGroups.entries()) {
    const pg = await db.group.create({
      data: {
        name: g.name, description: g.description, category: g.category as "READING", city: g.city, lat: g.lat, lng: g.lng, maxMembers: g.max,
        isPublic: true, ownerId: g.owner.id, inviteCode: "demo-pub-" + i,
        members: { create: [{ userId: g.owner.id, role: "OWNER" }] },
      },
    });
    await db.post.create({ data: { userId: g.owner.id, groupId: pg.id, category: g.category as "READING", content: "Chào mọi người, tuần này cùng giữ nhịp nhé!", createdAt: new Date(Date.now() - i * 86_400_000) } });
  }
  // Một yêu cầu tham gia đang chờ trưởng nhóm (demo) duyệt
  await db.groupJoinRequest.create({ data: { groupId: group.id, userId: friends[3]!.id, message: "Mình muốn tập dậy sớm và đọc 20 trang mỗi ngày, cho mình tham gia với!" } });

  // Một báo cáo mẫu cho trang kiểm duyệt
  await db.report.create({ data: { reporterId: friends[2]!.id, postId: created[3]!.id, reason: "Spam / quảng cáo" } });

  console.log(`✔ Seed xong cho ${email} (${today})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
