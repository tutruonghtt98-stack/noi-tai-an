"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run } from "@/lib/action";

export async function markAllNotificationsRead() {
  return run(async () => {
    const user = await requireUser();
    await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    revalidatePath("/", "layout");
  });
}
