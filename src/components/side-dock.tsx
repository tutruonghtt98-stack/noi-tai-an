"use client";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { User, Briefcase, Settings, Sparkles, Sun, Moon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAppTheme } from "@/lib/use-app-theme";
import { setTheme } from "@/actions/settings";
import Dock, { type DockItemData } from "@/components/ui/dock";

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** Thanh dọc nổi bên trái: chuyển Cá nhân/Công việc, Cài đặt, Nâng cấp Pro, đổi sáng/tối (desktop rộng). */
export function SideDock() {
  const path = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const theme = useAppTheme();
  const [, startTransition] = useTransition();
  const isWork = path.startsWith("/work");

  const toggleTheme = () => {
    const root = document.documentElement;
    const dark = theme === "dark";
    const next = dark ? "LIGHT" : "DARK";
    root.dataset.theme = next.toLowerCase();
    startTransition(async () => {
      await setTheme(next);
    });
  };

  const items: DockItemData[] = [
    { icon: <User className="size-5" aria-hidden />, label: t.work.switcherPersonal, active: !isWork, onClick: () => router.push("/dashboard") },
    { icon: <Briefcase className="size-5" aria-hidden />, label: t.work.switcherWork, active: isWork, onClick: () => router.push("/work/customers") },
    { separator: true },
    { icon: <Settings className="size-5" aria-hidden />, label: t.nav.settings, active: isActive(path, "/settings"), onClick: () => router.push("/settings") },
    { icon: <Sparkles className="size-5 text-accent-ink" aria-hidden />, label: t.common.upgrade, onClick: () => router.push("/billing") },
    {
      icon: theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />,
      label: t.settings.theme,
      onClick: toggleTheme,
    },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-40 hidden xl:block">
      <Dock
        items={items}
        position="left"
        theme={theme}
        accentColor="#f2c14e"
        baseItemSize={40}
        magnification={58}
        distance={130}
        panelHeight={56}
        gap={6}
        roundness={1}
        tiles={false}
        showLabels
        showIndicators
        showBadges={false}
        bounce
        className="pointer-events-auto"
      />
    </div>
  );
}
