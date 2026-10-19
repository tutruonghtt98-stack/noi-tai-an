import type { Metadata } from "next";
import Link from "next/link";
import { Users, Sparkles, Globe } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { db } from "@/lib/db";
import { limitsFor } from "@/lib/plan";
import { suggestGroups } from "@/lib/group-discovery";
import { Empty } from "@/components/ui/empty";
import { Avatar } from "@/components/ui/avatar";
import { NewGroupButton } from "@/components/community/group-ui";
import { DiscoverPanel, GroupCardView } from "@/components/community/discover";

export const metadata: Metadata = { title: "Nhóm đồng hành" };

export default async function GroupsPage() {
  const user = await requireUser();
  const { t } = await getI18n();
  const canRequest = limitsFor(user).joinPublicGroups;
  const [groups, suggested] = await Promise.all([
    db.group.findMany({
      where: { members: { some: { userId: user.id } } },
      include: {
        members: { include: { user: { select: { name: true, image: true } } }, orderBy: { joinedAt: "asc" } },
        _count: { select: { joinRequests: { where: { status: "PENDING" } } } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    suggestGroups(user.id),
  ]);

  return (
    <div className="grid grid-cols-1 gap-10">
      <section aria-labelledby="mine">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="mine" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
            <Users className="size-4" aria-hidden /> {t.community.group.mine}
          </h2>
          <NewGroupButton />
        </div>
        <p className="mb-4 max-w-2xl text-sm text-ink-2">
          {t.community.group.privacy} {t.community.group.limit}
        </p>
        {groups.length === 0 ? (
          <div className="card">
            <Empty icon={Users} text={t.community.group.empty} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => {
              const isOwner = g.ownerId === user.id;
              return (
                <Link key={g.id} href={`/community/groups/${g.id}`} className="card rise flex flex-col gap-3 transition-shadow hover:shadow-pop">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {g.isPublic && (
                      <span className="badge">
                        <Globe className="size-3" aria-hidden /> {t.groupSettings.public}
                      </span>
                    )}
                    {isOwner && g._count.joinRequests > 0 && (
                      <span className="badge bg-rose-soft text-rose-ink">{fmt(t.groupSettings.pending, { n: g._count.joinRequests })}</span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold">{g.name}</h3>
                  {g.description && <p className="line-clamp-2 text-sm text-ink-2">{g.description}</p>}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                    <div className="flex -space-x-2">
                      {g.members.slice(0, 6).map((m) => (
                        <Avatar key={m.userId} name={m.user.name ?? "?"} image={m.user.image} size={32} />
                      ))}
                    </div>
                    <span className="tabular text-sm text-muted">
                      {g.members.length}/{g.maxMembers}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="sugg">
        <h2 id="sugg" className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          <Sparkles className="size-4" aria-hidden /> {t.discover.suggested}
        </h2>
        {!canRequest && <p className="mb-4 rounded-2xl bg-ochre-soft p-3 text-sm text-ochre-ink">{t.discover.proRequired}</p>}
        {suggested.length === 0 ? (
          <p className="text-sm text-muted">{t.discover.suggestedEmpty}</p>
        ) : (
          <div className="grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2 xl:grid-cols-3">
            {suggested.map((g) => (
              <GroupCardView key={g.id} g={g} canRequest={canRequest} />
            ))}
          </div>
        )}
      </section>

      <DiscoverPanel canRequest={canRequest} />
    </div>
  );
}
