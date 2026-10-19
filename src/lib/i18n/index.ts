import "server-only";
import { cookies } from "next/headers";
import vi from "./vi";
import en from "./en";
import { getOptionalUser } from "@/lib/session";

export type Locale = "vi" | "en";
export const dictionaries = { vi, en } as const;

export async function getLocale(): Promise<Locale> {
  const user = await getOptionalUser();
  if (user?.locale === "en" || user?.locale === "vi") return user.locale;
  const c = (await cookies()).get("locale")?.value;
  return c === "en" ? "en" : "vi";
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}
