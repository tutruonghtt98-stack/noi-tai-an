import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { dictionaries } from "@/lib/i18n";
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

// Mặc định ẩn danh: khớp đúng tông/màu/mật độ CSS gốc (:root không có các data-*
// này vẫn ra kết quả giống hệt). Cho phép layout gốc prerender tĩnh thay vì SSR
// mỗi request. Người dùng đã đăng nhập được áp lại tuỳ chỉnh thật trong
// (app)/layout.tsx — xem PreferenceSync ở đó.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="system" data-accent="ochre" data-density="comfortable" className={font.variable}>
      <body className="min-h-dvh">
        <I18nProvider value={{ t: dictionaries.vi, locale: "vi" }}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
        <SpotlightCursor />
      </body>
    </html>
  );
}
