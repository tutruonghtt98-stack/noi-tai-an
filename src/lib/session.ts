import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Người dùng hiện tại (đầy đủ cài đặt). Chuyển về /login nếu chưa đăng nhập. */
export const requireUser = cache(async () => {
  // auth() dùng ngẫu nhiên nội bộ (jose) — khai báo rõ đây là request-time để
  // Cache Components không coi đó là giá trị "không ổn định" khi prerender.
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  if (user.bannedAt) redirect("/login?banned=1");
  return user;
});

/** Chỉ ADMIN. Người dùng thường bị chuyển về Dashboard. */
export const requireAdmin = cache(async () => {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
});

export const getOptionalUser = cache(async () => {
  await connection();
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findUnique({ where: { id: session.user.id } });
});

export type CurrentUser = Awaited<ReturnType<typeof requireUser>>;
