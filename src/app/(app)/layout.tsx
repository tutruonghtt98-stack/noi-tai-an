import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/session";
import { effectivePlan } from "@/lib/plan";
import { getI18n } from "@/lib/i18n";
import { Logo } from "@/components/logo";
import { MobileNav } from "@/components/nav";
import { ThemeToggle, UserMenu } from "@/components/user-menu";
import { AlertsCenter } from "@/components/alerts-center";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NotificationBellSlot, NotificationBellFallback } from "@/components/notification-bell-slot";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, , cookieStore] = await Promise.all([requireUser(), getI18n(), cookies()]);
  const name = user.name ?? user.email ?? "Bạn";
  const plan = effectivePlan(user);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
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
    </SidebarProvider>
  );
}
