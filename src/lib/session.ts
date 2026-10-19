import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** Người dùng hiện tại (đầy đủ cài đặt). Chuyển về /login nếu chưa đăng nhập. */
export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  return user;
});

export const getOptionalUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findUnique({ where: { id: session.user.id } });
});

export type CurrentUser = Awaited<ReturnType<typeof requireUser>>;
