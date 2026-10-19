"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { run } from "@/lib/action";

const THEME = z.enum(["LIGHT", "DARK", "SYSTEM"]);

export async function setTheme(theme: "LIGHT" | "DARK" | "SYSTEM") {
  return run(async () => {
    const user = await requireUser();
    const value = THEME.parse(theme);
    await db.user.update({ where: { id: user.id }, data: { theme: value } });
    (await cookies()).set("theme", value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    revalidatePath("/", "layout");
  });
}

const appearanceSchema = z.object({
  theme: THEME,
  accent: z.enum(["ochre", "jade", "mist", "rose"]),
  density: z.enum(["comfortable", "compact"]),
  locale: z.enum(["vi", "en"]),
});

export async function updateAppearance(input: z.input<typeof appearanceSchema>) {
  return run(async () => {
    const user = await requireUser();
    const data = appearanceSchema.parse(input);
    await db.user.update({ where: { id: user.id }, data });
    const jar = await cookies();
    const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
    jar.set("theme", data.theme, opts);
    jar.set("locale", data.locale, opts);
    revalidatePath("/", "layout");
  });
}

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }),
  weekStartsOn: z.coerce.number().int().min(0).max(1),
  focusMinutes: z.coerce.number().int().min(5).max(180),
  breakMinutes: z.coerce.number().int().min(1).max(60),
  dailyFocusGoal: z.coerce.number().int().min(0).max(960),
});

export async function updateProfile(input: z.input<typeof profileSchema>) {
  return run(async () => {
    const user = await requireUser();
    const data = profileSchema.parse(input);
    await db.user.update({ where: { id: user.id }, data });
    revalidatePath("/", "layout");
  });
}

/** Đặt ngôn ngữ trước khi đăng nhập (trang /login). */
export async function setLocaleCookie(locale: "vi" | "en") {
  (await cookies()).set("locale", locale === "en" ? "en" : "vi", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
