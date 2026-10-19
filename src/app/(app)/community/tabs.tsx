"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

export function CommunityTabs({ profileHref }: { profileHref: string }) {
  const { t } = useI18n();
  const path = usePathname();
  const tabs = [
    { href: "/community", label: t.community.tabs.feed, active: path === "/community" },
    { href: "/community/challenges", label: t.community.tabs.challenges, active: path.startsWith("/community/challenges") },
    { href: "/community/leaderboard", label: t.community.tabs.leaderboard, active: path.startsWith("/community/leaderboard") },
    { href: "/community/groups", label: t.community.tabs.groups, active: path.startsWith("/community/groups") },
    { href: profileHref, label: t.community.tabs.profile, active: false },
  ];
  return (
    <nav className="segmented no-scrollbar mb-6 flex w-fit max-w-full overflow-x-auto bg-surface shadow-card" aria-label={t.community.title}>
      {tabs.map((x) => (
        <Link key={x.label} href={x.href} aria-current={x.active ? "page" : undefined} className="shrink-0">
          {x.label}
        </Link>
      ))}
    </nav>
  );
}
