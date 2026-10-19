import Link from "next/link";
import { requireUser } from "@/lib/session";
import { effectivePlan } from "@/lib/plan";
import { Logo } from "@/components/logo";
import { DesktopNav, MobileNav } from "@/components/nav";
import { ThemeToggle, UserMenu } from "@/components/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const name = user.name ?? user.email ?? "Bạn";

  return (
    <div className="mx-auto min-h-dvh max-w-[1440px] px-4 pb-28 sm:px-6 md:pb-12 lg:px-8">
      <header className="flex items-center justify-between gap-4 py-5 md:py-6">
        <Link href="/dashboard" aria-label="Nội Tại Ẩn" className="shrink-0 rounded-xl">
          <Logo />
        </Link>
        <DesktopNav />
        <div className="flex items-center gap-2 rounded-full md:bg-surface md:p-1.5 md:shadow-card">
          <ThemeToggle />
          <UserMenu name={name} image={user.image} plan={effectivePlan(user)} />
        </div>
      </header>
      <main id="main">{children}</main>
      <MobileNav />
    </div>
  );
}
