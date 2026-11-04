"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { LayoutGrid, Target, Repeat, Users, Kanban, Building2, ChartColumn, Settings, Plus, type LucideIcon } from "lucide-react";
import {
  BottomNavigation,
  BottomNavigationAccessory,
  BottomNavigationHighlight,
  BottomNavigationHighlightItem,
  BottomNavigationItem,
  BottomNavigationLabel,
} from "@animate-ui/react/primitives/bottom-navigation";
import { Effects } from "@animate-ui/react/primitives/effects/effect";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { Modal } from "@/components/ui/modal";
import type { Dict } from "@/lib/i18n/vi";

type Item = { href: string; key: keyof Dict["nav"]; icon: LucideIcon };

export const NAV: Item[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutGrid },
  { href: "/goals", key: "goals", icon: Target },
  { href: "/habits", key: "habits", icon: Repeat },
  { href: "/customers", key: "customers", icon: Users },
  { href: "/workspace", key: "workspace", icon: Kanban },
  { href: "/departments", key: "departments", icon: Building2 },
  { href: "/analytics", key: "analytics", icon: ChartColumn },
  { href: "/settings", key: "settings", icon: Settings },
];

export const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** Mục menu chính dùng cho Sidebar — Cài đặt tách riêng xuống khu vực dưới cùng của sidebar. */
export const TOP_NAV = NAV.filter((i) => i.key !== "settings");

const MOBILE_QUERY = "(max-width: 767px)";

function subscribeMobile(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Theo dõi breakpoint mobile (md của Tailwind) — dùng để KHÔNG mount BottomNavigation trên desktop,
 * vì logic theo dõi cuộn trang của nó lỗi khi phần tử bị ẩn bằng CSS (md:hidden) trên trang rất dài. */
function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
}

/** Điều hướng dưới cùng cho mobile: thanh nổi bo tròn với 4 mục chính + nút "+" tròn tách riêng
 * mở các mục còn lại. Vệt sáng trượt theo mục active, icon nhấn nhẹ khi chạm, tự ẩn khi cuộn trang. */
export function MobileNav() {
  const path = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const primary = NAV.slice(0, 4);
  const rest = NAV.slice(4);
  const activeValue = primary.find((i) => isActive(path, i.href))?.href;

  if (!isMobile) return null;

  return (
    <>
      <BottomNavigation
        value={activeValue}
        scrollBehavior="minimize"
        aria-label={t.nav.mainNav}
        className="fixed inset-x-4 z-40 mx-auto flex w-fit max-w-full items-center gap-2.5 md:hidden"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <BottomNavigationHighlight className="absolute inset-x-1 inset-y-1.5 rounded-full bg-accent-soft">
          <ul className="relative mx-auto flex items-stretch rounded-full bg-surface px-2.5 shadow-pop ring-1 ring-line">
            <Effects asChild fade blur slide={{ direction: "up", offset: 10 }} holdDelay={40}>
              {primary.map(({ href, key, icon: Icon }) => {
                const active = isActive(path, href);
                return (
                  <li key={href}>
                    <BottomNavigationHighlightItem value={href}>
                      <BottomNavigationItem
                        asChild
                        value={href}
                        className={cn(
                          "relative z-10 flex h-16 flex-col items-center justify-center gap-1 whitespace-nowrap px-3.5 text-[0.625rem] font-medium data-[minimized]:size-12 data-[minimized]:px-0",
                          active ? "text-ink" : "text-muted",
                        )}
                      >
                        <Link href={href} aria-current={active ? "page" : undefined}>
                          <Icon className="size-5" aria-hidden />
                          <BottomNavigationLabel className="whitespace-nowrap">{t.nav[key]}</BottomNavigationLabel>
                        </Link>
                      </BottomNavigationItem>
                    </BottomNavigationHighlightItem>
                  </li>
                );
              })}
            </Effects>
          </ul>
        </BottomNavigationHighlight>
        <BottomNavigationAccessory className="size-16 shrink-0 rounded-full bg-ink shadow-pop data-[minimized]:size-12">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t.nav.more}
            className="flex size-full items-center justify-center rounded-full text-bg active:scale-95"
          >
            <Plus className="size-6" aria-hidden />
          </button>
        </BottomNavigationAccessory>
      </BottomNavigation>
      <Modal open={open} onClose={() => setOpen(false)} title={t.nav.more}>
        <ul className="grid grid-cols-2 gap-3">
          {rest.map(({ href, key, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 font-medium hover:bg-surface-3"
              >
                <Icon className="size-5" aria-hidden />
                {t.nav[key]}
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
