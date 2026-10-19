import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Crown, Flame, Target } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { db } from "@/lib/db";
import { fromDbDate, startOfWeek, todayISO } from "@/lib/dates";
import { weeklyLeaderboard } from "@/lib/leaderboard";
import { getFeed } from "@/lib/community";
import { Avatar } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/progress-ring";
import { Composer } from "@/components/community/composer";
import { FeedList } from "@/components/community/feed-list";
import { CommitmentForm, InviteBox, LeaveGroupButton, RemoveMemberButton } from "@/components/community/group-ui";
import { GroupSettingsForm, JoinRequests } from "@/components/community/group-admin";

export const metadata: Metadata = { title: "Nhóm đồng hành" };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const { id } = await params;
  const group = await db.group.findUnique({
    where: { id },
    include: { members: { include: { user: { select: { id: true, name: true, image: true } } }, orderBy: { joinedAt: "asc" } } },
  });
  const me = group?.members.find((m) => m.userId === user.id);
  if (!group || !me) notFound(); // Không lộ sự tồn tại của nhóm với người ngoài

  const today = todayISO(user.timezone);
  const week = startOfWeek(today, user.weekStartsOn);
  const [stats, feed, requests] = await Promise.all([
    weeklyLeaderboard(week, today, user.id, group.members.map((m) => m.userId)),
    getFeed(user.id, { groupId: id }),
    me.role === "OWNER"
      ? db.groupJoinRequest.findMany({ where: { groupId: id, status: "PENDING" }, include: { user: { select: { name: true, image: true } } }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
  ]);
  const statOf = (uid: string) => stats.find((s) => s.userId === uid);
  const isOwner = me.role === "OWNER";
  const currentCommitment = (m: (typeof group.members)[number]) => (m.commitmentWeek && fromDbDate(m.commitmentWeek) === week ? m.commitment : null);
  const isWeekend = [0, 6].includes(new Date(`${today}T00:00:00Z`).getUTCDay());

  return (
    <>
      <Link href="/community/groups" className="btn btn-ghost -ml-3 mb-4">
        <ArrowLeft className="size-4" aria-hidden /> {t.community.tabs.groups}
      </Link>
      <section className="card hero-glow mb-[var(--gap)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h1 className="text-3xl font-semibold sm:text-4xl">{group.name}</h1>
            {group.description && <p className="mt-2 text-ink-2">{group.description}</p>}
            <p className="mt-2 text-sm text-muted">
              {group.members.length}/{group.maxMembers} · {t.community.group.privacy}
            </p>
          </div>
          <LeaveGroupButton groupId={id} />
        </div>
        <div className="mt-5 max-w-xl">
          <InviteBox groupId={id} code={group.inviteCode} isOwner={isOwner} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-[var(--gap)]">
          <section className="card" aria-labelledby="commit">
            <h2 id="commit" className="card-title mb-3 flex items-center gap-2">
              <Target className="size-5 text-rose-ink" aria-hidden /> {t.community.group.commitment}
            </h2>
            <CommitmentForm groupId={id} initial={currentCommitment(me) ?? ""} />
          </section>

          <section aria-labelledby="updates" className="grid grid-cols-1 gap-[var(--gap)]">
            <h2 id="updates" className="card-title">
              {t.community.group.updates}
            </h2>
            <Composer groupId={id} placeholder={isWeekend ? t.community.group.summaryPh : t.community.group.updatePh} kind={isWeekend ? "SUMMARY" : "POST"} />
            <FeedList initial={feed.items} nextCursor={feed.nextCursor} filter={{ groupId: id }} />
          </section>
        </div>

        <aside className="grid content-start gap-[var(--gap)]">
          {isOwner && (
            <section className="card" aria-labelledby="jr">
              <h2 id="jr" className="card-title mb-4">
                {t.groupSettings.requests}
                {requests.length > 0 && <span className="badge ml-2 bg-rose-soft align-middle text-rose-ink">{requests.length}</span>}
              </h2>
              <JoinRequests requests={requests.map((r) => ({ id: r.id, message: r.message, createdAt: r.createdAt.toISOString(), user: { name: r.user.name ?? "—", image: r.user.image } }))} />
            </section>
          )}
          {isOwner && (
            <section className="card" aria-labelledby="gs">
              <h2 id="gs" className="card-title mb-4">
                {t.groupSettings.title}
              </h2>
              <GroupSettingsForm
                groupId={id}
                initial={{ isPublic: group.isPublic, category: group.category, city: group.city ?? "", description: group.description ?? "", lat: group.lat, lng: group.lng }}
              />
            </section>
          )}
          <section className="card" aria-labelledby="summary">
            <h2 id="summary" className="card-title">
              {t.community.group.summary}
            </h2>
            <p className="mb-4 mt-1 text-sm text-muted">{t.community.group.summaryDesc}</p>
            <ul className="space-y-4">
              {group.members.map((m) => {
                const s = statOf(m.userId);
                const commitment = currentCommitment(m);
                return (
                  <li key={m.userId} className="rounded-2xl bg-surface-2 p-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.user.name ?? "?"} image={m.user.image} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate font-medium">
                          {m.user.name}
                          {m.role === "OWNER" && <Crown className="size-4 text-ochre-ink" aria-label={t.community.group.owner} />}
                        </p>
                        <p className="tabular flex gap-3 text-xs text-muted">
                          <span>
                            {s?.checkinDays ?? 0}/7 {t.community.board.checkinDays.toLowerCase()}
                          </span>
                          <span className="inline-flex items-center gap-0.5">
                            <Flame className="size-3.5 text-rose" aria-hidden /> {s?.streak ?? 0}
                          </span>
                        </p>
                      </div>
                      <span className="tabular text-sm font-semibold">{Math.round((s?.completion ?? 0) * 100)}%</span>
                      {isOwner && m.userId !== user.id && <RemoveMemberButton groupId={id} memberId={m.userId} name={m.user.name ?? ""} />}
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={s?.completion ?? 0} color="var(--chart-2)" label={m.user.name ?? ""} />
                    </div>
                    <p className="mt-2 text-sm text-ink-2">{commitment ? `“${commitment}”` : <span className="text-muted">{t.community.group.noCommitment}</span>}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
