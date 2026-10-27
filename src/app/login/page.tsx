import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getOptionalUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { devLoginEnabled, googleEnabled } from "@/auth";
import { signInDev, signInGoogle } from "@/actions/auth";
import { Logo } from "@/components/logo";
import { LocaleSwitch } from "./locale-switch";

export const metadata: Metadata = { title: "Đăng nhập" };

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ banned?: string }> }) {
  if (await getOptionalUser()) redirect("/dashboard");
  const { banned } = await searchParams;
  const { t, locale } = await getI18n();
  const googleOk = googleEnabled();
  const devOk = devLoginEnabled();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Bảng thương hiệu */}
      <section className="relative hidden overflow-hidden bg-ink p-12 text-bg lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--accent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 -left-24 size-[28rem] rounded-full opacity-15 blur-3xl"
          style={{ background: "var(--jade)" }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
              <rect x="1" y="1" width="30" height="30" rx="10" fill="var(--bg)" />
              <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--accent)" strokeWidth="3" />
              <circle cx="16" cy="16" r="3" fill="var(--accent)" />
            </svg>
            <span className="text-xl font-semibold tracking-tight">{t.brand.name}</span>
          </span>
        </div>
        <div className="relative max-w-lg">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">{t.brand.tagline}</p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.1]">
            {locale === "en" ? "Win the day, quietly." : "Thắng một ngày, lặng lẽ."}
          </h1>
          <ul className="mt-10 space-y-4">
            {t.auth.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-bg/80">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-ink">
                  <Check className="size-4" aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-bg/50">© {new Date().getFullYear()} {t.brand.name}</p>
      </section>

      {/* Form đăng nhập */}
      <section className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <span className="lg:invisible">
            <Logo />
          </span>
          <LocaleSwitch locale={locale} />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h2 className="text-3xl font-semibold">{t.auth.title}</h2>
          <p className="mt-3 text-ink-2">{t.auth.subtitle}</p>

          {banned && (
            <p role="alert" className="mt-6 rounded-2xl bg-rose-soft p-4 text-sm text-rose-ink">
              {locale === "en" ? "This account has been suspended. Contact support for help." : "Tài khoản này đã bị tạm khoá. Vui lòng liên hệ hỗ trợ."}
            </p>
          )}
          <div className="mt-10 space-y-3">
            {googleOk && (
              <form action={signInGoogle}>
                <button className="btn w-full border border-line bg-surface text-ink shadow-card hover:bg-surface-2">
                  <GoogleIcon /> {t.auth.google}
                </button>
              </form>
            )}
            {devOk && (
              <form action={signInDev}>
                <button className="btn btn-primary w-full">{t.auth.dev}</button>
              </form>
            )}
            {!googleOk && !devOk && (
              <p role="alert" className="rounded-2xl bg-rose-soft p-4 text-sm text-rose-ink">
                {t.auth.noProvider}
              </p>
            )}
          </div>
          <p className="mt-8 text-xs leading-relaxed text-muted">{t.auth.terms}</p>
          <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted" aria-label="Legal">
            {(
              [
                ["/pricing", t.legal.pricing],
                ["/terms", t.legal.terms],
                ["/privacy", t.legal.privacy],
                ["/refund", t.legal.refund],
                ["/contact", t.legal.contact],
              ] as const
            ).map(([href, label]) => (
              <Link key={href} href={href} className="underline-offset-4 hover:text-ink hover:underline">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </div>
  );
}
