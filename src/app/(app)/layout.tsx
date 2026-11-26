import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/session";
import { effectivePlan } from "@/lib/plan";
import { dictionaries } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { Logo } from "@/components/logo";
import { MobileNav } from "@/components/nav";
import { ThemeToggle, UserMenu } from "@/components/user-menu";
import { AlertsCenter } from "@/components/alerts-center";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NotificationBellSlot, NotificationBellFallback } from "@/components/notification-bell-slot";

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([requireUser(), cookies()]);
  const name = user.name ?? user.email ?? "Bạn";
  const plan = effectivePlan(user);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const locale = user.locale === "en" ? "en" : "vi";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      {/* Root layout prerender tĩnh với theme/accent/density mặc định (ẩn danh) —
          bù lại tuỳ chỉnh thật của người dùng ngay trên <html> trước khi vẽ. */}
      <PreferenceSync theme={user.theme.toLowerCase()} accent={user.accent} density={user.density} />
      <I18nProvider value={{ t: dictionaries[locale], locale }}>
        <Sidebar
          name={name}
          image={user.image}
          plan={plan}
          isAdmin={user.role === "ADMIN"}
          notificationSlot={
            <Suspense fallback={<NotificationBellFallback />}>
              <NotificationBellSlot userId={user.id} placement="above" />
            </Suspense>
          }
        />
        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1440px] px-4 pb-28 sm:px-6 md:pb-6 lg:px-8">
            <header className="flex items-center justify-between gap-4 py-3 md:hidden">
              <Link href="/dashboard" aria-label="Nội Tại Ẩn" className="shrink-0 rounded-xl">
                <Logo />
              </Link>
              <div className="flex items-center gap-2 rounded-full bg-surface p-1.5 shadow-card">
                <Suspense fallback={<NotificationBellFallback />}>
                  <NotificationBellSlot userId={user.id} />
                </Suspense>
                <ThemeToggle />
                <UserMenu name={name} image={user.image} plan={plan} isAdmin={user.role === "ADMIN"} />
              </div>
            </header>
            <main id="main" className="mt-3 md:mt-6">
              {children}
            </main>
          </div>
        </div>
        <MobileNav />
        <AlertsCenter />
      </I18nProvider>
    </SidebarProvider>
  );
}

/**
 * Root layout prerender tĩnh với các data-* mặc định (ẩn danh) để các trang
 * công khai không bị buộc SSR. Script này sửa lại ngay trên <html> theo đúng
 * tuỳ chỉnh thật của người dùng, chạy trong cùng response nên không có
 * flash — khác với theme ẩn danh, nơi mặc định vốn đã đúng.
 */
function PreferenceSync({
  theme,
  accent,
  density,
}: {
  theme: string;
  accent: string;
  density: string;
}) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(d){d.theme=${JSON.stringify(theme)};d.accent=${JSON.stringify(accent)};d.density=${JSON.stringify(density)};})(document.documentElement.dataset);`,
      }}
    />
  );
}
