"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import {
  LayoutGrid,
  Target,
  Repeat,
  ListChecks,
  ChartColumn,
  NotebookPen,
  Users,
  Settings,
  Ellipsis,
  Package,
  ShoppingBag,
  MessageSquare,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { Modal } from "@/components/ui/modal";
import { GooeyNav } from "@/components/ui/gooey-nav";
import { useAppTheme } from "@/lib/use-app-theme";
import type { Dict } from "@/lib/i18n/vi";

type Item = { href: string; key: keyof Dict["nav"]; icon: LucideIcon };

export const NAV: Item[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutGrid },
  { href: "/today", key: "today", icon: ListChecks },
  { href: "/habits", key: "habits", icon: Repeat },
  { href: "/goals", key: "goals", icon: Target },
  { href: "/analytics", key: "analytics", icon: ChartColumn },
  { href: "/reflection", key: "reflection", icon: NotebookPen },
  { href: "/community", key: "community", icon: Users },
  { href: "/settings", key: "settings", icon: Settings },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** Khớp theo href dài nhất (cụ thể nhất) — tránh "/work" khớp nhầm mọi "/work/*". */
const bestMatchIndex = (list: { href: string }[], path: string) => {
  let best = -1;
  let bestLen = -1;
  list.forEach((item, i) => {
    if (isActive(path, item.href) && item.href.length > bestLen) {
      best = i;
      bestLen = item.href.length;
    }
  });
  return Math.max(0, best);
};

/** Cài đặt chuyển sang thanh dọc bên trái (SideDock) nên bỏ khỏi thanh ngang. */
const TOP_NAV = NAV.filter((i) => i.key !== "settings");

type WorkItem = { href: string; key: keyof Dict["work"]["nav"]; icon: LucideIcon };

export const WORK_NAV: WorkItem[] = [
  { href: "/work", key: "dashboard", icon: LayoutGrid },
  { href: "/work/orders", key: "orders", icon: Package },
  { href: "/work/products", key: "products", icon: ShoppingBag },
  { href: "/work/customers", key: "customers", icon: Users },
  { href: "/work/messages", key: "messages", icon: MessageSquare },
  { href: "/work/analytics", key: "analytics", icon: ChartColumn },
  { href: "/work/automations", key: "automations", icon: Workflow },
];

/** Thanh điều hướng dạng "pill" ở giữa header: hiệu ứng "giọt keo" lỏng chảy sang mục đang chọn (tablet/desktop). */
export function DesktopNav() {
  const path = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const theme = useAppTheme();
  const isWork = path.startsWith("/work");
  const items = isWork
    ? WORK_NAV.map(({ href, key, icon: Icon }) => ({ href, label: t.work.nav[key], icon: <Icon aria-hidden strokeWidth={1.9} /> }))
    : TOP_NAV.map(({ href, key, icon: Icon }) => ({ href, label: t.nav[key], icon: <Icon aria-hidden strokeWidth={1.9} /> }));
  const activeIndex = bestMatchIndex(isWork ? WORK_NAV : TOP_NAV, path);

  return (
    <nav aria-label={t.nav.mainNav} className="hidden md:block">
      <GooeyNav
        items={items}
        activeIndex={activeIndex}
        onNavigate={(href) => router.push(href)}
        onChange={() => {}}
        theme={theme}
        color="#f2c14e" // --ochre trong globals.css — màu nhấn thương hiệu, không đổi theo theme
        size="md"
        pillShadow={0}
        animationTime={550}
        gooeyness={0.55}
        style={
          {
            "--gn-gap": "2px",
            "--gn-x": "18px",
            "--gn-y": "11px",
            "--gn-pad": "6px",
            "--gn-frame": "var(--surface)",
          } as CSSProperties
        }
      />
    </nav>
  );
}

/** Điều hướng dưới cùng cho mobile: 4 mục chính + "Thêm". */
export function MobileNav() {
  const path = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const primary = NAV.slice(0, 4);
  const rest = NAV.slice(4);
  const restActive = rest.some((i) => isActive(path, i.href));

  return (
    <>
      <nav
        aria-label={t.nav.mainNav}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {primary.map(({ href, key, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                    active ? "text-ink" : "text-muted",
                  )}
                >
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-accent-soft")}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {t.nav[key]}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                restActive ? "text-ink" : "text-muted",
              )}
            >
              <span className={cn("grid h-7 w-12 place-items-center rounded-full", restActive && "bg-accent-soft")}>
                <Ellipsis className="size-5" aria-hidden />
              </span>
              {t.nav.more}
            </button>
          </li>
        </ul>
      </nav>
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
