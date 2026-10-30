"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { ThemeToggle } from "@/components/user-menu";

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** Thanh dọc nổi bên trái: Cộng đồng, Cài đặt, Nâng cấp Pro, đổi giao diện sáng/tối (desktop rộng). */
export function SideDock() {
  const path = usePathname();
  const { t } = useI18n();
  const items = [
    { href: "/community", label: t.nav.community, icon: Users },
    { href: "/settings", label: t.nav.settings, icon: Settings },
  ];

  return (
    <nav
      aria-label={`${t.nav.community} / ${t.nav.settings}`}
      className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1 rounded-full bg-surface p-2 shadow-card xl:flex"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            title={label}
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-200",
              active ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="size-5" aria-hidden />
          </Link>
        );
      })}

      <Link
        href="/billing"
        aria-label={t.common.upgrade}
        title={t.common.upgrade}
        className="grid size-11 shrink-0 place-items-center rounded-full text-accent-ink transition-colors duration-200 hover:bg-accent-soft"
      >
        <Sparkles className="size-5" aria-hidden />
      </Link>

      <div className="my-1 h-px w-6 bg-line" aria-hidden />
      <ThemeToggle />
    </nav>
  );
}
