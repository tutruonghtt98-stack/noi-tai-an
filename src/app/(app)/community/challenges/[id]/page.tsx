import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Check } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { db } from "@/lib/db";
import { addDays, daysBetween, formatDate, fromDbDate, todayISO } from "@/lib/dates";
import { challengeWindow, completionTarget } from "@/lib/challenges";
import { ProgressBar, ProgressRing } from "@/components/ui/progress-ring";
import { Avatar } from "@/components/ui/avatar";
import { CheckinPanel, JoinButton } from "@/components/community/challenge-ui";
import { FeedList } from "@/components/community/feed-list";
import { cn } from "@/lib/cn";
import { getConnections, getFeed } from "@/lib/community";
import { InviteMoreButton } from "@/components/community/people-picker";

export const metadata: Metadata = { title: "Thử thách" };

export default async function ChallengeDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const { id } = await params;
  const c = await db.challenge.findFirst({
    where: { id, archivedAt: null },
    include: { creator: { select: { name: true } }, _count: { select: { members: true, checkins: true } } },
  });
  if (!c) notFound();
  const today = todayISO(user.timezone);
  const w = challengeWindow(c, today);

  const [member, myCheckins, ranking, feed] = await Promise.all([
    db.challengeMember.findUnique({ where: { challengeId_userId: { challengeId: id, userId: user.id } } }),
    db.challengeCheckin.findMany({ where: { challengeId: id, userId: user.id }, select: { date: true, note: true } }),
    db.challengeCheckin.groupBy({ by: ["userId"], where: { challengeId: id }, _count: true, orderBy: { _count: { userId: "desc" } }, take: 10 }),
    getFeed(user.id, { challengeId: id }),
  ]);
  const [connections, memberRows] = await Promise.all([
    getConnections(user.id),
    db.challengeMember.findMany({ where: { challengeId: id }, select: { userId: true } }),
  ]);
  const memberIds = memberRows.map((m) => m.userId);
  const people = connections;
  const rankPeople = await db.user.findMany({
    where: { id: { in: ranking.map((r) => r.userId) } },
    select: { id: true, name: true, image: true, leaderboardOptIn: true, username: true, profilePublic: true },
  });

  const done = new Set(myCheckins.map((x) => fromDbDate(x.date)));
  const todayNote = myCheckins.find((x) => fromDbDate(x.date) === today)?.note ?? "";
  const target = completionTarget(c.durationDays);
  const elapsed = w.state === "upcoming" ? 0 : Math.min(c.durationDays, daysBetween(w.start, today) + 1);
  const possible = c._count.members * elapsed;
  const days = Array.from({ length: c.durationDays }, (_, i) => addDays(w.start, i));

  return (
    <>
      <Link href="/community/challenges" className="btn btn-ghost -ml-3 mb-4">
        <ArrowLeft className="size-4" aria-hidden /> {t.community.tabs.challenges}
      </Link>

      <section className="card hero-glow mb-[var(--gap)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-1.5">
              {c.official && (
                <span className="badge bg-ochre-soft text-ochre-ink">
                  <BadgeCheck className="size-3.5" aria-hidden /> {t.community.challenge.official}
                </span>
              )}
              <span className="badge">{t.community.categories[c.category]}</span>
              <span className="badge">{fmt(t.community.challenge.days, { n: c.durationDays })}</span>
              <span className="badge">{fmt(t.community.challenge.members, { n: c._count.members })}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{c.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {formatDate(w.start, locale, { day: "numeric", month: "long" })} – {formatDate(w.end, locale, { day: "numeric", month: "long", year: "numeric" })} · {c.creator.name}
            </p>
            {c.description && <p className="mt-3 whitespace-pre-wrap text-ink-2">{c.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {member && w.state !== "ended" && <InviteMoreButton challengeId={c.id} people={people} memberIds={memberIds} />}
            <JoinButton id={c.id} joined={!!member} canLeave={!!member && !member.completedAt && c.creatorId !== user.id} ended={w.state === "ended"} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-[var(--gap)]">
          {member && (
            <section className="card" aria-labelledby="mine">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="mine" className="card-title">
                  {t.community.challenge.myProgress}
                </h2>
                <span className="tabular text-sm text-muted">
                  {done.size}/{target} · {t.community.challenge.completeRule}
                </span>
              </div>
              {member.completedAt && <p className="mb-4 rounded-2xl bg-jade-soft p-3 text-sm font-semibold text-jade-ink">{t.community.challenge.completed}</p>}
              <ol className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
                {days.map((d, i) => {
                  const ok = done.has(d);
                  return (
                    <li
                      key={d}
                      title={d}
                      className={cn(
                        "tabular grid aspect-square place-items-center rounded-xl text-xs font-semibold",
                        ok ? "bg-jade text-[#1d1c1a]" : d < today ? "bg-surface-2 text-muted" : "border border-dashed border-line text-muted",
                        d === today && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
                      )}
                      aria-label={`${t.community.challenge.dayOf.replace("{d}", String(i + 1)).replace("{t}", String(c.durationDays))}${ok ? " ✓" : ""}`}
                    >
                      {ok ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section aria-labelledby="recent">
            <h2 id="recent" className="card-title mb-4">
              {t.community.challenge.recent}
            </h2>
            <FeedList initial={feed.items} nextCursor={feed.nextCursor} filter={{ challengeId: id }} isAdmin={user.role === "ADMIN"} />
          </section>
        </div>

        <aside className="grid content-start gap-[var(--gap)]">
          <section className="card" aria-label={t.community.challenge.checkin}>
            {!member ? (
              <p className="text-sm text-muted">{t.community.challenge.notMember}</p>
            ) : w.state === "upcoming" ? (
              <p className="text-sm text-muted">{t.community.challenge.notStarted}</p>
            ) : w.state === "ended" ? (
              <p className="text-sm text-muted">{t.community.challenge.over}</p>
            ) : (
              <>
                <p className="mb-3 text-sm font-medium text-muted">{fmt(t.community.challenge.dayOf, { d: w.dayIndex, t: c.durationDays })}</p>
                <CheckinPanel id={id} checkedIn={done.has(today)} note={todayNote} />
              </>
            )}
          </section>

          <section className="card" aria-labelledby="group-p">
            <h2 id="group-p" className="card-title mb-4">
              {t.community.challenge.groupProgress}
            </h2>
            <div className="flex items-center gap-4">
              <ProgressRing value={possible ? c._count.checkins / possible : 0} size={76} stroke={8} color="var(--chart-2)">
                <span className="tabular text-sm font-semibold">{possible ? Math.round((c._count.checkins / possible) * 100) : 0}%</span>
              </ProgressRing>
              <p className="text-sm text-ink-2">{fmt(t.community.challenge.groupProgressDesc, { c: c._count.checkins, e: possible })}</p>
            </div>
          </section>

          <section className="card" aria-labelledby="ch-rank">
            <h2 id="ch-rank" className="card-title mb-4">
              {t.community.board.title}
            </h2>
            <ol className="space-y-3">
              {ranking.map((r, i) => {
                const p = rankPeople.find((x) => x.id === r.userId);
                const visible = p?.leaderboardOptIn || r.userId === user.id;
                const name = visible ? (r.userId === user.id ? `${p?.name ?? ""} (${t.community.board.you})` : p?.name ?? "—") : t.community.board.anon;
                return (
                  <li key={r.userId} className="flex items-center gap-3">
                    <span className="tabular w-5 text-sm font-semibold text-muted">{i + 1}</span>
                    <Avatar name={visible ? p?.name ?? "?" : "?"} image={visible ? p?.image : null} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{name}</span>
                      <ProgressBar value={r._count / c.durationDays} color="var(--chart-2)" label={name} />
                    </span>
                    <span className="tabular text-sm text-ink-2">
                      {r._count}/{c.durationDays}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
