"use client";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { SegmentLinks } from "@/components/ui/segment-links";

export function CommunityTabs({ profileHref }: { profileHref: string }) {
  const { t } = useI18n();
  const path = usePathname();
  const tabs = [
    { value: "feed", href: "/community", label: t.community.tabs.feed, active: path === "/community" },
    { value: "challenges", href: "/community/challenges", label: t.community.tabs.challenges, active: path.startsWith("/community/challenges") },
    { value: "leaderboard", href: "/community/leaderboard", label: t.community.tabs.leaderboard, active: path.startsWith("/community/leaderboard") },
    { value: "groups", href: "/community/groups", label: t.community.tabs.groups, active: path.startsWith("/community/groups") },
    { value: "profile", href: profileHref, label: t.community.tabs.profile, active: path === profileHref },
  ];
  const active = tabs.find((x) => x.active)?.value ?? "feed";

  return (
    <SegmentLinks
      ariaLabel={t.community.title}
      active={active}
      className="mb-6 w-fit"
      items={tabs.map(({ value, href, label }) => ({ value, href, label }))}
    />
  );
}
