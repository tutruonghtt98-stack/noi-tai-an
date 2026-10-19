"use client";
import { useTransition } from "react";
import { setLocaleCookie } from "@/actions/settings";

export function LocaleSwitch({ locale }: { locale: "vi" | "en" }) {
  const [pending, start] = useTransition();
  return (
    <div className="segmented" aria-busy={pending}>
      {(["vi", "en"] as const).map((l) => (
        <button key={l} type="button" aria-pressed={locale === l} onClick={() => start(() => setLocaleCookie(l))}>
          {l === "vi" ? "Tiếng Việt" : "English"}
        </button>
      ))}
    </div>
  );
}
