"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  LayoutGrid,
  Target,
  Repeat,
  ListChecks,
  ChartColumn,
  NotebookPen,
  Users,
  Settings,
  Ellipsis,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { Modal } from "@/components/ui/modal";
import type { Dict } from "@/lib/i18n/vi";

gsap.registerPlugin(useGSAP);

type Item = { href: string; key: keyof Dict["nav"]; icon: LucideIcon };

export const NAV: Item[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutGrid },
  { href: "/today", key: "today", icon: ListChecks },
  { href: "/habits", key: "habits", icon: Repeat },
  { href: "/goals", key: "goals", icon: Target },
  { href: "/analytics", key: "analytics", icon: ChartColumn },
  { href: "/reflection", key: "reflection", icon: NotebookPen },
  { href: "/community", key: "community", icon: Users },
  { href: "/settings", key: "settings", icon: Settings },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

const PILL_ICON = 20; // size-5
const PILL_PAD_COLLAPSED = (44 - PILL_ICON) / 2; // căn icon giữa vòng tròn 44px

/** Một mục trong thanh "pill": co giãn mượt giữa vòng tròn chỉ-icon và viên nang icon+tên. */
function NavPillItem({ href, label, active, icon: Icon }: { href: string; label: string; active: boolean; icon: LucideIcon }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      if (!linkRef.current || !labelRef.current) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = reduced ? 0 : 0.45;
      const tl = gsap.timeline();
      if (active) {
        const w = labelRef.current.scrollWidth;
        tl.to(linkRef.current, { paddingLeft: 16, paddingRight: 20, duration, ease: "power3.out" }, 0)
          .to(labelRef.current, { width: w, opacity: 1, marginLeft: 8, duration, ease: "power3.out" }, 0)
          .fromTo(iconRef.current, { scale: 0.8 }, { scale: 1, duration, ease: "back.out(2.6)" }, 0);
      } else {
        tl.to(linkRef.current, { paddingLeft: PILL_PAD_COLLAPSED, paddingRight: PILL_PAD_COLLAPSED, duration, ease: "power3.inOut" }, 0).to(
          labelRef.current,
          { width: 0, opacity: 0, marginLeft: 0, duration, ease: "power3.inOut" },
          0,
        );
      }
      return () => {
        tl.kill();
      };
    },
    { dependencies: [active], scope: linkRef },
  );

  return (
    <Link
      ref={linkRef}
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-11 items-center rounded-full transition-colors duration-200",
        active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
      )}
      style={{
        paddingLeft: active ? 16 : PILL_PAD_COLLAPSED,
        paddingRight: active ? 20 : PILL_PAD_COLLAPSED,
      }}
    >
      <Icon ref={iconRef} className="size-5 shrink-0" aria-hidden strokeWidth={active ? 2.2 : 1.8} />
      <span
        ref={labelRef}
        className="inline-block overflow-hidden whitespace-nowrap text-[0.9375rem]"
        style={{ width: active ? "auto" : 0, opacity: active ? 1 : 0, marginLeft: active ? 8 : 0 }}
      >
        {label}
      </span>
    </Link>
  );
}

/** Thanh điều hướng dạng "pill" ở giữa header (tablet/desktop). */
export function DesktopNav() {
  const path = usePathname();
  const { t } = useI18n();
  return (
    <nav aria-label={t.nav.mainNav} className="hidden md:block">
      <ul className="flex items-center gap-1 rounded-full bg-surface p-1.5 shadow-card">
        {NAV.map(({ href, key, icon }) => (
          <li key={href}>
            <NavPillItem href={href} label={t.nav[key]} active={isActive(path, href)} icon={icon} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Điều hướng dưới cùng cho mobile: 4 mục chính + "Thêm". */
export function MobileNav() {
  const path = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const primary = NAV.slice(0, 4);
  const rest = NAV.slice(4);
  const restActive = rest.some((i) => isActive(path, i.href));

  return (
    <>
      <nav
        aria-label={t.nav.mainNav}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {primary.map(({ href, key, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                    active ? "text-ink" : "text-muted",
                  )}
                >
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-accent-soft")}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {t.nav[key]}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                restActive ? "text-ink" : "text-muted",
              )}
            >
              <span className={cn("grid h-7 w-12 place-items-center rounded-full", restActive && "bg-accent-soft")}>
                <Ellipsis className="size-5" aria-hidden />
              </span>
              {t.nav.more}
            </button>
          </li>
        </ul>
      </nav>
      <Modal open={open} onClose={() => setOpen(false)} title={t.nav.more}>
        <ul className="grid grid-cols-2 gap-3">
          {rest.map(({ href, key, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 font-medium hover:bg-surface-3"
              >
                <Icon className="size-5" aria-hidden />
                {t.nav[key]}
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
