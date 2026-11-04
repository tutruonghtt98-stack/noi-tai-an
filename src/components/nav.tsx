"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, Target, Repeat, Users, Kanban, Building2, ChartColumn, Settings, Ellipsis, type LucideIcon } from "lucide-react";
import {
  BottomNavigation,
  BottomNavigationHighlight,
  BottomNavigationHighlightItem,
  BottomNavigationItem,
  BottomNavigationLabel,
} from "@animate-ui/react/primitives/bottom-navigation";
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

const MORE = "more";

/** Điều hướng dưới cùng cho mobile: 4 mục chính + "Thêm". Vệt sáng trượt theo mục active,
 * icon nhấn nhẹ khi chạm, và tự thu nhỏ/ẩn khi cuộn trang (giống bottom-navigation của animate-ui). */
export function MobileNav() {
  const path = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const primary = NAV.slice(0, 4);
  const rest = NAV.slice(4);
  const restActive = rest.some((i) => isActive(path, i.href));
  const activeValue = primary.find((i) => isActive(path, i.href))?.href ?? (restActive ? MORE : undefined);

  return (
    <>
      <BottomNavigation
        value={activeValue}
        scrollBehavior="hide"
        aria-label={t.nav.mainNav}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <BottomNavigationHighlight className="absolute inset-x-2 inset-y-1.5 rounded-2xl bg-accent-soft">
          <ul className="relative mx-auto grid max-w-md grid-cols-5">
            {primary.map(({ href, key, icon: Icon }) => {
              const active = isActive(path, href);
              return (
                <li key={href}>
                  <BottomNavigationHighlightItem value={href}>
                    <BottomNavigationItem
                      asChild
                      value={href}
                      className={cn(
                        "relative z-10 flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                        active ? "text-ink" : "text-muted",
                      )}
                    >
                      <Link href={href} aria-current={active ? "page" : undefined}>
                        <Icon className="size-5" aria-hidden />
                        <BottomNavigationLabel>{t.nav[key]}</BottomNavigationLabel>
                      </Link>
                    </BottomNavigationItem>
                  </BottomNavigationHighlightItem>
                </li>
              );
            })}
            <li>
              <BottomNavigationHighlightItem value={MORE}>
                <BottomNavigationItem
                  asChild
                  value={MORE}
                  className={cn(
                    "relative z-10 flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                    restActive ? "text-ink" : "text-muted",
                  )}
                >
                  <button type="button" onClick={() => setOpen(true)}>
                    <Ellipsis className="size-5" aria-hidden />
                    <BottomNavigationLabel>{t.nav.more}</BottomNavigationLabel>
                  </button>
                </BottomNavigationItem>
              </BottomNavigationHighlightItem>
            </li>
          </ul>
        </BottomNavigationHighlight>
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
