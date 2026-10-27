import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { CATEGORIES, getFeed } from "@/lib/community";
import { Composer } from "@/components/community/composer";
import { FeedList } from "@/components/community/feed-list";
import { CommunitySidebar } from "@/components/community/sidebar";
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
  const feed = await getFeed(user.id, { category, followingOf: following ? user.id : null });

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

      <CommunitySidebar />
    </div>
  );
}
