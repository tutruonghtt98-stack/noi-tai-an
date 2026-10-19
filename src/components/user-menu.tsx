"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { LogOut, Settings, Sun, Moon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { signOutAction } from "@/actions/auth";
import { setTheme } from "@/actions/settings";
import { Avatar } from "@/components/ui/avatar";

export function UserMenu({ name, image, plan }: { name: string; image: string | null; plan: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.nav.account}
        className="block rounded-full transition-transform active:scale-95"
      >
        <Avatar name={name} image={image} size={44} />
      </button>
      {open && (
        <div role="menu" className="rise absolute right-0 top-14 z-50 w-64 rounded-3xl border border-line bg-surface p-2 shadow-pop">
          <div className="px-3 py-2">
            <p className="truncate font-semibold">{name}</p>
            <span className="badge mt-1 bg-accent-soft text-accent-ink">{plan}</span>
          </div>
          <hr className="my-1 border-line" />
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <Settings className="size-5" aria-hidden /> {t.nav.settings}
          </Link>
          <form action={signOutAction}>
            <button
              role="menuitem"
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <LogOut className="size-5" aria-hidden /> {t.nav.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Đổi nhanh sáng/tối. Đồng bộ ngay trên <html> rồi lưu vào hồ sơ. */
export function ThemeToggle() {
  const { t } = useI18n();
  const [, start] = useTransition();
  const toggle = () => {
    const root = document.documentElement;
    const current = root.dataset.theme;
    const dark =
      current === "dark" || (current === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = dark ? "LIGHT" : "DARK";
    root.dataset.theme = next.toLowerCase();
    start(async () => {
      await setTheme(next);
    });
  };
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={t.settings.theme} title={t.settings.theme}>
      <Sun className="hidden size-5 [:root[data-theme=dark]_&]:block" aria-hidden />
      <Moon className="size-5 [:root[data-theme=dark]_&]:hidden" aria-hidden />
    </button>
  );
}
