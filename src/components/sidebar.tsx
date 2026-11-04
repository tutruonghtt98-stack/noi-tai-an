"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, Sparkles, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { LogoMark } from "@/components/logo";
import { NotificationBell, type NotificationItem } from "@/components/notification-bell";
import { ThemeToggle, UserMenu } from "@/components/user-menu";
import { TOP_NAV, isActive } from "@/components/nav";

const STORAGE_KEY = "nta-sidebar-collapsed";

/** Cột điều hướng dọc bên trái (md+): logo, menu chính, và cụm điều khiển toàn cục (thông báo/theme/tài khoản)
 * gộp xuống đáy — có nút thu gọn/mở rộng, nhớ trạng thái qua localStorage. */
export function Sidebar({
  name,
  image,
  plan,
  isAdmin,
  notifications,
  unreadCount,
}: {
  name: string;
  image: string | null;
  plan: string;
  isAdmin: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const path = usePathname();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {}
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface md:flex",
        mounted && "transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className={cn("flex items-center gap-2 p-4", collapsed && "flex-col")}>
        <Link href="/dashboard" aria-label="Nội Tại Ẩn" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl">
          <LogoMark className="size-8 shrink-0" />
          {!collapsed && <span className="truncate text-lg font-semibold tracking-tight">Nội Tại Ẩn</span>}
        </Link>
        <button
          type="button"
          onClick={toggle}
          className="icon-btn icon-btn-plain shrink-0"
          aria-label={collapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
          title={collapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
        >
          {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <ChevronsLeft className="size-4" aria-hidden />}
        </button>
      </div>

      <nav aria-label={t.nav.mainNav} className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {TOP_NAV.map(({ href, key, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? t.nav[key] : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    collapsed && "justify-center px-0",
                    active ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{t.nav[key]}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn("flex flex-col gap-1 border-t border-line p-3", collapsed && "items-center")}>
        <Link
          href="/settings"
          aria-current={isActive(path, "/settings") ? "page" : undefined}
          title={collapsed ? t.nav.settings : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            collapsed && "justify-center px-0",
            isActive(path, "/settings") ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Settings className="size-5 shrink-0" aria-hidden />
          {!collapsed && <span className="truncate">{t.nav.settings}</span>}
        </Link>
        <Link
          href="/billing"
          title={collapsed ? t.common.upgrade : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-accent-ink transition-colors hover:bg-surface-2",
            collapsed && "justify-center px-0",
          )}
        >
          <Sparkles className="size-5 shrink-0" aria-hidden />
          {!collapsed && <span className="truncate">{t.common.upgrade}</span>}
        </Link>

        <div className={cn("mt-1 flex items-center gap-2", collapsed ? "flex-col" : "justify-between")}>
          <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
            <NotificationBell notifications={notifications} unreadCount={unreadCount} placement="above" />
            <ThemeToggle />
          </div>
          <UserMenu name={name} image={image} plan={plan} isAdmin={isAdmin} placement="above" />
        </div>
      </div>
    </aside>
  );
}
