"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, Sparkles, Settings } from "lucide-react";
import { Effects } from "@animate-ui/react/primitives/effects/effect";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { LogoMark } from "@/components/logo";
import { ThemeToggle, UserMenu } from "@/components/user-menu";
import { TOP_NAV, isActive } from "@/components/nav";
import {
  Sidebar as SidebarRoot,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTriggerIcon,
  useSidebar,
} from "@/components/ui/sidebar";

/** Cột điều hướng dọc bên trái (md+): logo, menu chính, và cụm điều khiển toàn cục (thông báo/theme/tài khoản)
 * gộp xuống đáy. Dựng trên primitive @animate-ui/react/sidebar — co giãn mượt khi thu gọn/mở rộng và vệt
 * sáng (highlight) trượt theo mục đang hover/active, giống phong cách Vercel/Linear.
 * `notificationSlot` được truyền từ layout dưới dạng <Suspense> để không chặn render nội dung trang. */
export function Sidebar({
  name,
  image,
  plan,
  isAdmin,
  notificationSlot,
}: {
  name: string;
  image: string | null;
  plan: string;
  isAdmin: boolean;
  notificationSlot: ReactNode;
}) {
  const path = usePathname();
  const { t } = useI18n();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarRoot>
      <SidebarHeader className={cn("flex-row items-center gap-2", collapsed && "flex-col")}>
        <Link href="/dashboard" aria-label="Nội Tại Ẩn" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl">
          <LogoMark className="size-8 shrink-0" />
          {!collapsed && <span className="truncate text-lg font-semibold tracking-tight">Nội Tại Ẩn</span>}
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          className="icon-btn icon-btn-plain shrink-0"
          aria-label={collapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
          title={collapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
        >
          <SidebarTriggerIcon
            open={<ChevronsLeft className="size-4" aria-hidden />}
            closed={<ChevronsRight className="size-4" aria-hidden />}
          />
        </button>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label={t.nav.mainNav}>
          <SidebarMenu>
            <Effects asChild fade blur slide={{ direction: "left", offset: 16 }} holdDelay={40}>
              {TOP_NAV.map(({ href, key, icon: Icon }) => {
                const active = isActive(path, href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild active={active} tooltip={t.nav[key]}>
                      <Link href={href} aria-current={active ? "page" : undefined}>
                        <Icon aria-hidden />
                        <span>{t.nav[key]}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </Effects>
          </SidebarMenu>
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild active={isActive(path, "/settings")} tooltip={t.nav.settings}>
              <Link href="/settings" aria-current={isActive(path, "/settings") ? "page" : undefined}>
                <Settings aria-hidden />
                <span>{t.nav.settings}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t.common.upgrade} className="text-accent-ink">
              <Link href="/billing">
                <Sparkles aria-hidden />
                <span>{t.common.upgrade}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className={cn("mt-1 flex items-center gap-2", collapsed ? "flex-col" : "justify-between")}>
          <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
            {notificationSlot}
            <ThemeToggle />
          </div>
          <UserMenu name={name} image={image} plan={plan} isAdmin={isAdmin} placement="above" />
        </div>
      </SidebarFooter>
    </SidebarRoot>
  );
}
