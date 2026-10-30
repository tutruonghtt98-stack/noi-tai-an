import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/session";
import { effectivePlan } from "@/lib/plan";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { getHeaderGroupmates } from "@/lib/queries";
import { Logo } from "@/components/logo";
import { DesktopNav, MobileNav } from "@/components/nav";
import { ThemeToggle, UserMenu } from "@/components/user-menu";
import { AlertsCenter } from "@/components/alerts-center";
import { SideDock } from "@/components/side-dock";
import { HeaderGroupmates } from "@/components/header-groupmates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, { t }] = await Promise.all([requireUser(), getI18n()]);
  const name = user.name ?? user.email ?? "Bạn";
  const plan = effectivePlan(user);
  const groupmates = await getHeaderGroupmates(user.id);

  const planLabel = plan === "FREE" ? t.settings.planFree : plan === "PRO" ? t.settings.planPro : t.settings.planTeam;
  const daysLeft = user.planExpiresAt ? Math.max(0, Math.ceil((user.planExpiresAt.getTime() - Date.now()) / 86400000)) : null;
  const logoSubtitle = daysLeft != null ? fmt(t.common.daysLeft, { plan: planLabel, n: daysLeft }) : planLabel;

  return (
    <div className="mx-auto min-h-dvh max-w-[1440px] px-4 pb-28 sm:px-6 md:pb-12 lg:px-8 xl:pl-28">
      <SideDock />
      <header className="flex items-center justify-between gap-4 py-3 md:py-4">
        <Link href="/dashboard" aria-label="Nội Tại Ẩn" className="shrink-0 rounded-xl">
          <Logo subtitle={logoSubtitle} />
        </Link>
        <DesktopNav />
        <div className="flex items-center gap-3">
          <HeaderGroupmates people={groupmates} />
          <div className="flex items-center gap-2 rounded-full md:bg-surface md:p-1.5 md:shadow-card">
            <Link href="/settings#alerts" className="icon-btn" aria-label={t.common.notifications} title={t.common.notifications}>
              <Bell className="size-5" aria-hidden />
            </Link>
            <ThemeToggle />
            <UserMenu name={name} image={user.image} plan={effectivePlan(user)} isAdmin={user.role === "ADMIN"} />
          </div>
        </div>
      </header>
      <main id="main" className="mt-3 md:mt-4">
        {children}
      </main>
      <MobileNav />
      <AlertsCenter />
    </div>
  );
}
