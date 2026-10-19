import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarDays, Trophy, Users } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { db } from "@/lib/db";
import { addDays, dayOfWeek, formatDate, toDbDate, todayISO } from "@/lib/dates";
import { challengeWindow } from "@/lib/challenges";
import { limitsFor } from "@/lib/plan";
import { Empty } from "@/components/ui/empty";
import { JoinButton, NewChallengeButton } from "@/components/community/challenge-ui";
import { cn } from "@/lib/cn";
import { getConnections } from "@/lib/community";
import { InviteCard } from "@/components/community/people-picker";

export const metadata: Metadata = { title: "Thử thách" };

export default async function ChallengesPage() {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const today = todayISO(user.timezone);
  const challenges = await db.challenge.findMany({
    where: { archivedAt: null, startDate: { gte: toDbDate(addDays(today, -60)) } },
    orderBy: [{ official: "desc" }, { startDate: "asc" }],
    take: 60,
    include: { _count: { select: { members: true } }, members: { where: { userId: user.id }, select: { completedAt: true } } },
  });
  const [people, invites] = await Promise.all([
    getConnections(user.id),
    db.challengeInvite.findMany({
      where: { inviteeId: user.id, status: "PENDING", challenge: { archivedAt: null } },
      include: { inviter: { select: { id: true, name: true, image: true } }, challenge: { select: { title: true, durationDays: true, startDate: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const view = challenges.map((c) => ({ ...c, w: challengeWindow(c, today), joined: c.members.length > 0 }));
  const mine = view.filter((c) => c.joined);
  const explore = view.filter((c) => !c.joined && c.w.state !== "ended");
  const dow = dayOfWeek(today);
  const nextMonday = addDays(today, ((8 - dow) % 7) || 7);

  const stateLabel = { upcoming: t.community.challenge.upcoming, active: t.community.challenge.active, ended: t.community.challenge.ended };

  const Card = ({ c }: { c: (typeof view)[number] }) => (
    <article className={cn("card flex flex-col gap-3", c.official && "ring-2 ring-ochre")}>
      <div className="flex flex-wrap items-center gap-1.5">
        {c.official && (
          <span className="badge bg-ochre-soft text-ochre-ink">
            <BadgeCheck className="size-3.5" aria-hidden /> {t.community.challenge.official}
          </span>
        )}
        <span className={cn("badge", c.w.state === "active" && "bg-jade-soft text-jade-ink")}>{stateLabel[c.w.state]}</span>
        <span className="badge">{t.community.categories[c.category]}</span>
      </div>
      <Link href={`/community/challenges/${c.id}`} className="text-lg font-semibold leading-snug hover:underline">
        {c.title}
      </Link>
      {c.description && <p className="line-clamp-2 text-sm text-ink-2">{c.description}</p>}
      <p className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden />
          {c.w.state === "upcoming"
            ? fmt(t.community.challenge.startsOn, { d: formatDate(c.w.start, locale, { day: "numeric", month: "numeric" }) })
            : c.w.state === "active"
              ? fmt(t.community.challenge.dayOf, { d: c.w.dayIndex, t: c.durationDays })
              : fmt(t.community.challenge.days, { n: c.durationDays })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-4" aria-hidden /> {fmt(t.community.challenge.members, { n: c._count.members })}
        </span>
      </p>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
        <Link href={`/community/challenges/${c.id}`} className="text-sm font-medium underline-offset-4 hover:underline">
          {t.common.seeAll} →
        </Link>
        <JoinButton id={c.id} joined={c.joined} ended={c.w.state === "ended"} />
      </div>
    </article>
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">{t.community.challenge.completeRule}</p>
        <NewChallengeButton
          canCreate={user.role === "ADMIN" || limitsFor(user).createChallenges}
          isAdmin={user.role === "ADMIN"}
          today={today}
          tomorrow={addDays(today, 1)}
          nextMonday={nextMonday}
          people={people}
        />
      </div>
      {invites.length > 0 && (
        <section className="mb-10 rounded-[1.75rem] bg-accent-soft p-4 sm:p-5" aria-labelledby="inv">
          <h2 id="inv" className="mb-3 font-semibold">
            {t.challengeInvite.title} · {invites.length}
          </h2>
          <ul className="space-y-2">
            {invites.map((i) => (
              <InviteCard key={i.id} id={i.id} inviter={{ id: i.inviter.id, name: i.inviter.name ?? "—", image: i.inviter.image }} title={i.challenge.title} days={i.challenge.durationDays} />
            ))}
          </ul>
        </section>
      )}
      {mine.length > 0 && (
        <section className="mb-10" aria-labelledby="mine">
          <h2 id="mine" className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
            <Trophy className="size-4" aria-hidden /> {t.community.challenge.mine}
          </h2>
          <div className="grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2 xl:grid-cols-3">
            {mine.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="explore">
        <h2 id="explore" className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          {t.community.challenge.explore}
        </h2>
        {explore.length === 0 ? (
          <div className="card">
            <Empty icon={Trophy} text={t.community.challenge.empty} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2 xl:grid-cols-3">
            {explore.map((c) => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
