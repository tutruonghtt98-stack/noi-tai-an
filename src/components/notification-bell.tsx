"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";
import { markAllNotificationsRead } from "@/actions/notifications";
import { Avatar } from "@/components/ui/avatar";

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: Date;
  actor: { name: string | null; image: string | null } | null;
};

function timeAgo(date: Date, t: ReturnType<typeof useI18n>["t"]) {
  const min = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (min < 1) return t.notificationsCenter.justNow;
  if (min < 60) return fmt(t.notificationsCenter.minutesAgo, { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return fmt(t.notificationsCenter.hoursAgo, { n: hr });
  return fmt(t.notificationsCenter.daysAgo, { n: Math.floor(hr / 24) });
}

export function NotificationBell({ notifications, unreadCount }: { notifications: NotificationItem[]; unreadCount: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(unreadCount);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      start(() => {
        void markAllNotificationsRead();
      });
    }
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} className="icon-btn relative" aria-label={t.common.notifications} title={t.common.notifications}>
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="tabular absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="rise absolute right-0 top-14 z-50 w-80 max-w-[90vw] rounded-3xl border border-line bg-surface p-2 shadow-pop">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="font-semibold">{t.notificationsCenter.title}</p>
            <Link href="/settings#alerts" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink">
              {t.notificationsCenter.settings}
            </Link>
          </div>
          <hr className="my-1 border-line" />
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">{t.notificationsCenter.empty}</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map((n) => {
                const content = (
                  <div className={cn("flex items-start gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-2", !n.read && "bg-accent-soft/40")}>
                    <Avatar name={n.actor?.name ?? "?"} image={n.actor?.image} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{n.title}</p>
                      {n.body && <p className="mt-0.5 truncate text-sm font-medium text-ink-2">{n.body}</p>}
                      <p className="mt-1 text-xs text-muted">{timeAgo(n.createdAt, t)}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden />}
                  </div>
                );
                return (
                  <li key={n.id} role="menuitem">
                    {n.href ? (
                      <Link href={n.href} onClick={() => setOpen(false)}>
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
