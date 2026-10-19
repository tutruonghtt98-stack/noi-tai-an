import Link from "next/link";
import { getOptionalUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { Logo } from "@/components/logo";
import { business } from "@/lib/business";
import { SiteFooter } from "@/components/site-footer";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [user, { t }] = await Promise.all([getOptionalUser(), getI18n()]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1200px] flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 py-5">
        <Link href={user ? "/dashboard" : "/login"} className="rounded-xl" aria-label={business.brand}>
          <Logo />
        </Link>
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/pricing" className="btn btn-ghost btn-sm">
            {t.legal.pricing}
          </Link>
          <Link href={user ? "/dashboard" : "/login"} className="btn btn-primary btn-sm">
            {user ? t.nav.dashboard : t.auth.signIn}
          </Link>
        </nav>
      </header>
      <main className="flex-1 py-6 md:py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
