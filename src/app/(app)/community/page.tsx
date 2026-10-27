import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Users } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { db } from "@/lib/db";
import { CATEGORIES, getFeed } from "@/lib/community";
import { challengeWindow } from "@/lib/challenges";
import { todayISO } from "@/lib/dates";
import { Composer } from "@/components/community/composer";
import { FeedList } from "@/components/community/feed-list";
import type { PostCategory } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Cộng đồng" };

export default async function CommunityFeed({ searchParams }: { searchParams: Promise<{ cat?: string; f?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const sp = await searchParams;
  const category = CATEGORIES.includes(sp.cat as PostCategory) ? (sp.cat as PostCategory) : null;
  const following = sp.f === "following";
  const qs = (o: { cat?: string | null; f?: boolean }) => {
    const p = new URLSearchParams();
    if (o.cat) p.set("cat", o.cat);
    if (o.f) p.set("f", "following");
    const s = p.toString();
    return s ? `/community?${s}` : "/community";
  };
  const today = todayISO(user.timezone);

  const [feed, myChallenges, myGroups] = await Promise.all([
    getFeed(user.id, { category, followingOf: following ? user.id : null }),
    db.challengeMember.findMany({
      where: { userId: user.id, challenge: { archivedAt: null } },
      include: { challenge: true },
      orderBy: { joinedAt: "desc" },
      take: 8,
    }),
    db.groupMember.findMany({ where: { userId: user.id }, include: { group: { include: { _count: { select: { members: true } } } } }, take: 5 }),
  ]);
  const active = myChallenges.filter((m) => challengeWindow(m.challenge, today).state === "active");

  return (
    <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid min-w-0 grid-cols-1 content-start gap-[var(--gap)]">
        <Composer />
        <nav className="segmented w-fit bg-surface shadow-card" aria-label={t.follow.feedFollowing}>
          <Link href={qs({ cat: category })} aria-current={!following ? "page" : undefined}>
            {t.follow.feedAll}
          </Link>
          <Link href={qs({ cat: category, f: true })} aria-current={following ? "page" : undefined}>
            {t.follow.feedFollowing}
          </Link>
        </nav>
        <nav className="no-scrollbar flex gap-1.5 overflow-x-auto" aria-label="Category">
          {[null, ...CATEGORIES].map((c) => (
            <Link
              key={c ?? "all"}
              href={qs({ cat: c, f: following })}
              aria-current={category === c ? "page" : undefined}
              className="min-h-9 shrink-0 rounded-full bg-surface px-4 py-2 text-sm font-medium text-ink-2 shadow-card aria-[current=page]:bg-ink aria-[current=page]:text-bg"
            >
              {c ? t.community.categories[c] : t.community.all}
            </Link>
          ))}
        </nav>
        <FeedList
          key={`${category ?? "all"}-${following}`}
          initial={feed.items}
          nextCursor={feed.nextCursor}
          filter={{ category, following }}
          isAdmin={user.role === "ADMIN"}
          emptyText={following ? t.follow.followingEmpty : undefined}
        />
      </div>

      <aside className="grid content-start gap-[var(--gap)]">
        <section className="card" aria-labelledby="my-ch">
          <h2 id="my-ch" className="card-title mb-4 flex items-center gap-2">
            <Trophy className="size-5 text-ochre-ink" aria-hidden /> {t.community.challenge.mine}
          </h2>
          {active.length === 0 ? (
            <Link href="/community/challenges" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
              {t.community.challenge.explore} →
            </Link>
          ) : (
            <ul className="space-y-2">
              {active.map((m) => {
                const w = challengeWindow(m.challenge, today);
                return (
                  <li key={m.challengeId}>
                    <Link href={`/community/challenges/${m.challengeId}`} className="block rounded-2xl bg-surface-2 p-3 hover:bg-surface-3">
                      <span className="block truncate font-medium">{m.challenge.title}</span>
                      <span className="text-xs text-muted">{fmt(t.community.challenge.dayOf, { d: w.dayIndex, t: m.challenge.durationDays })}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="my-gr">
          <h2 id="my-gr" className="card-title mb-4 flex items-center gap-2">
            <Users className="size-5 text-jade-ink" aria-hidden /> {t.community.group.mine}
          </h2>
          {myGroups.length === 0 ? (
            <Link href="/community/groups" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
              {t.community.group.new} →
            </Link>
          ) : (
            <ul className="space-y-2">
              {myGroups.map((m) => (
                <li key={m.groupId}>
                  <Link href={`/community/groups/${m.groupId}`} className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 p-3 hover:bg-surface-3">
                    <span className="truncate font-medium">{m.group.name}</span>
                    <span className="tabular shrink-0 text-xs text-muted">
                      {m.group._count.members}/{m.group.maxMembers}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
