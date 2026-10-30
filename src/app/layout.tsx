import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { getOptionalUser } from "@/lib/session";
import { dictionaries, getLocale } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { ToastProvider } from "@/components/ui/toast";
import { SpotlightCursor } from "@/components/spotlight-cursor";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Nội Tại Ẩn — Kỷ luật từ bên trong", template: "%s · Nội Tại Ẩn" },
  description:
    "Nền tảng kỷ luật cá nhân: mục tiêu năm–quý–tháng, theo dõi thói quen, Top 3 ưu tiên mỗi ngày và phiên tập trung sâu.",
  applicationName: "Nội Tại Ẩn",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, locale, jar] = await Promise.all([getOptionalUser(), getLocale(), cookies()]);
  const theme = (user?.theme ?? jar.get("theme")?.value ?? "SYSTEM").toLowerCase();
  const accent = user?.accent ?? "ochre";
  const density = user?.density ?? "comfortable";

  return (
    <html lang={locale} data-theme={theme} data-accent={accent} data-density={density} className={font.variable}>
      <body className="min-h-dvh">
        <I18nProvider value={{ t: dictionaries[locale], locale }}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
        <SpotlightCursor />
      </body>
    </html>
  );
}
