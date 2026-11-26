import Link from "next/link";
import { Suspense } from "react";
import { getOptionalUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { Logo } from "@/components/logo";
import { business } from "@/lib/business";
import { SiteFooter } from "@/components/site-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1200px] flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 py-5">
        <Link href="/login" className="rounded-xl" aria-label={business.brand}>
          <Logo />
        </Link>
        {/* Phần duy nhất phụ thuộc session/cookie — tách riêng để phần còn lại của
            layout (và các trang tĩnh bên dưới) có thể prerender tĩnh thật. */}
        <Suspense fallback={<AuthNavFallback />}>
          <AuthNav />
        </Suspense>
      </header>
      <main className="flex-1 py-6 md:py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}

function AuthNavFallback() {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <Link href="/pricing" className="btn btn-ghost btn-sm">
        Bảng giá
      </Link>
      <Link href="/login" className="btn btn-primary btn-sm">
        Đăng nhập
      </Link>
    </nav>
  );
}

async function AuthNav() {
  const [user, { t }] = await Promise.all([getOptionalUser(), getI18n()]);
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <Link href="/pricing" className="btn btn-ghost btn-sm">
        {t.legal.pricing}
      </Link>
      <Link href={user ? "/dashboard" : "/login"} className="btn btn-primary btn-sm">
        {user ? t.nav.dashboard : t.auth.signIn}
      </Link>
    </nav>
  );
}
