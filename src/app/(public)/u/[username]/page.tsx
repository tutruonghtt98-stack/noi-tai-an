import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, Lock, Trophy, Target, Flag, Sparkles, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getOptionalUser, type CurrentUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { todayISO } from "@/lib/dates";
import { getFeed } from "@/lib/community";
import { getGoals, getHabitsWithStats } from "@/lib/queries";
import { syncBadges, BADGES } from "@/lib/badges";
import { Avatar } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/progress-ring";
import { FeedList } from "@/components/community/feed-list";
import { FollowButton } from "@/components/community/follow-button";
import { AvatarUploader } from "@/components/community/avatar-uploader";
import { colorVar } from "@/lib/colors";
import { cn } from "@/lib/cn";

type Params = { params: Promise<{ username: string }> };

async function load(username: string) {
  return db.user.findUnique({ where: { username: username.toLowerCase() } });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const u = await load((await params).username);
  if (!u?.profilePublic) return { title: "Hồ sơ", robots: { index: false } };
  return { title: `${u.name} · Hồ sơ hành trình`, description: u.bio ?? undefined };
}

function OnlyYou({ show, label }: { show: boolean; label: string }) {
  if (show) return null;
  return (
    <span className="badge ml-2 align-middle">
      <Lock className="size-3" aria-hidden /> {label}
    </span>
  );
}

export default async function ProfilePage({ params }: Params) {
  const { username } = await params;
  const [profile, viewer, { t, locale }] = await Promise.all([load(username), getOptionalUser(), getI18n()]);
  if (!profile || profile.bannedAt) notFound();
  const isOwner = viewer?.id === profile.id;
  const p = t.community.profile;

  if (!profile.profilePublic && !isOwner) {
    return (
      <section className="card mx-auto max-w-md py-14 text-center">
        <Lock className="mx-auto size-10 text-muted" aria-hidden />
        <p className="mt-4 text-ink-2">{p.private}</p>
      </section>
    );
  }

  if (isOwner) await syncBadges(profile.id);
  const see = (flag: boolean) => isOwner || flag;
  const today = todayISO(profile.timezone);
  const asUser = profile as CurrentUser;

  const [followers, followingCount, iFollow] = await Promise.all([
    db.follow.count({ where: { followingId: profile.id } }),
    db.follow.count({ where: { followerId: profile.id } }),
    viewer && !isOwner ? db.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: profile.id } } }) : null,
  ]);
  const [badges, goals, habits, focus, challenges, feed] = await Promise.all([
    see(profile.showBadges) ? db.userBadge.findMany({ where: { userId: profile.id }, orderBy: { awardedAt: "desc" } }) : [],
    see(profile.showGoals) || see(profile.showStats) ? getGoals(asUser) : [],
    see(profile.showStats) ? getHabitsWithStats(asUser, today, 200) : [],
    see(profile.showStats) ? db.focusSession.aggregate({ where: { userId: profile.id }, _sum: { actualMinutes: true } }) : null,
    see(profile.showChallenges)
      ? db.challengeMember.findMany({ where: { userId: profile.id, completedAt: { not: null } }, include: { challenge: { select: { id: true, title: true, durationDays: true, official: true } } }, orderBy: { completedAt: "desc" } })
      : [],
    viewer ? getFeed(viewer.id, { authorId: profile.id }) : null,
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", { dateStyle: "medium" });
  const completedGoals = goals.filter((g) => g.status === "COMPLETED");
  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.stats.best), 0);

  const badgeLabel = (code: string, meta: string | null) =>
    (BADGES as readonly string[]).includes(code) ? t.community.badges[code as (typeof BADGES)[number]] : [meta ?? code, t.community.challenge.official];

  // Dòng thời gian cột mốc
  type Milestone = { at: Date; icon: typeof Award; text: string };
  const milestones: Milestone[] = [
    { at: profile.createdAt, icon: Sparkles, text: p.milestoneJoin },
    ...(see(profile.showGoals) ? completedGoals.filter((g) => g.completedAt).map((g) => ({ at: new Date(g.completedAt!), icon: Target, text: fmt(p.milestoneGoal, { t: g.title }) })) : []),
    ...challenges.map((c) => ({ at: c.completedAt!, icon: Trophy, text: fmt(p.milestoneChallenge, { t: c.challenge.title }) })),
    ...badges.map((b) => ({ at: b.awardedAt, icon: Award, text: fmt(p.milestoneBadge, { t: badgeLabel(b.code, b.meta)[0]! }) })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-[var(--gap)]">
      <section className="card hero-glow">
        <div className="flex flex-wrap items-center gap-5">
          {isOwner ? <AvatarUploader name={profile.name ?? "?"} image={profile.image} /> : <Avatar name={profile.name ?? "?"} image={profile.image} size={88} />}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold">{profile.name}</h1>
            <p className="text-muted">
              @{profile.username} · {fmt(p.memberSince, { d: dateFmt.format(profile.createdAt) })}
            </p>
            {profile.bio && <p className="mt-2 max-w-xl text-ink-2">{profile.bio}</p>}
            <p className="mt-2 flex gap-4 text-sm">
              <span>
                <strong className="tabular">{followers}</strong> <span className="text-muted">{t.follow.followers}</span>
              </span>
              <span>
                <strong className="tabular">{followingCount}</strong> <span className="text-muted">{t.follow.followingLabel}</span>
              </span>
            </p>
          </div>
          {viewer && !isOwner && <FollowButton userId={profile.id} initial={!!iFollow} />}
          {isOwner && (
            <div className="flex flex-col items-end gap-2">
              {!profile.profilePublic && (
                <span className="badge">
                  <Lock className="size-3" aria-hidden /> {p.onlyYou}
                </span>
              )}
              <Link href="/settings#journey" className="btn btn-soft btn-sm">
                <Pencil className="size-4" aria-hidden /> {p.edit}
              </Link>
            </div>
          )}
        </div>
      </section>

      {see(profile.showStats) && (
        <section className="card grid grid-cols-2 gap-3 p-3 sm:p-4 md:grid-cols-4" aria-label={p.stats}>
          {[
            [p.totalFocus, `${Math.round((focus?._sum.actualMinutes ?? 0) / 60)}h`],
            [p.bestStreak, `${bestStreak}`],
            [p.goalsDone, `${completedGoals.length}`],
            [p.challengesDone, `${challenges.length}`],
          ].map(([l, v]) => (
            <div key={l} className="rounded-[1.5rem] bg-surface-2 p-5">
              <p className="text-sm text-ink-2">{l}</p>
              <p className="tabular mt-3 text-3xl font-semibold">{v}</p>
            </div>
          ))}
          <OnlyYou show={profile.showStats} label={p.onlyYou} />
        </section>
      )}

      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-2">
        {see(profile.showBadges) && (
          <section className="card" aria-labelledby="badges">
            <h2 id="badges" className="card-title mb-4">
              {p.badges}
              <OnlyYou show={profile.showBadges} label={p.onlyYou} />
            </h2>
            {badges.length === 0 ? (
              <p className="text-sm text-muted">{p.noBadges}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {badges.map((b) => {
                  const [name, desc] = badgeLabel(b.code, b.meta);
                  return (
                    <li key={b.code} className="rounded-2xl bg-surface-2 p-3 text-center" title={desc}>
                      <span className={cn("mx-auto grid size-12 place-items-center rounded-full", b.code.startsWith("CH_") ? "bg-ochre" : "bg-accent-soft")}>
                        <Award className="size-6 text-[#1d1c1a]" aria-hidden />
                      </span>
                      <p className="mt-2 text-sm font-semibold leading-tight">{name}</p>
                      <p className="mt-0.5 text-xs text-muted">{desc}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {see(profile.showGoals) && (
          <section className="card" aria-labelledby="goals">
            <h2 id="goals" className="card-title mb-4">
              {p.goals}
              <OnlyYou show={profile.showGoals} label={p.onlyYou} />
            </h2>
            <ul className="space-y-4">
              {activeGoals.slice(0, 6).map((g) => (
                <li key={g.id}>
                  <div className="mb-1.5 flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{g.title}</span>
                    <span className="tabular text-muted">{Math.round(g.progress * 100)}%</span>
                  </div>
                  <ProgressBar value={g.progress} color={colorVar(g.color)} label={g.title} />
                </li>
              ))}
              {activeGoals.length === 0 && <li className="text-sm text-muted">—</li>}
            </ul>
          </section>
        )}

        {see(profile.showChallenges) && (
          <section className="card" aria-labelledby="chs">
            <h2 id="chs" className="card-title mb-4">
              {p.challenges}
              <OnlyYou show={profile.showChallenges} label={p.onlyYou} />
            </h2>
            <ul className="space-y-2">
              {challenges.map((c) => (
                <li key={c.challengeId} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                  <Trophy className={cn("size-5 shrink-0", c.challenge.official ? "text-ochre-ink" : "text-muted")} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.challenge.title}</span>
                  <span className="text-xs text-muted">{fmt(t.community.challenge.days, { n: c.challenge.durationDays })}</span>
                </li>
              ))}
              {challenges.length === 0 && <li className="text-sm text-muted">—</li>}
            </ul>
          </section>
        )}

        <section className="card" aria-labelledby="ms">
          <h2 id="ms" className="card-title mb-4">
            {p.milestones}
          </h2>
          <ol className="relative space-y-4 border-l-2 border-line pl-6">
            {milestones.slice(0, 12).map((m, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[37px] grid size-8 place-items-center rounded-full bg-surface ring-2 ring-line">
                  <m.icon className="size-4 text-ink-2" aria-hidden />
                </span>
                <p className="text-sm font-medium">{m.text}</p>
                <p className="text-xs text-muted">{dateFmt.format(m.at)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {feed && (
        <section aria-labelledby="posts" className="grid grid-cols-1 gap-[var(--gap)]">
          <h2 id="posts" className="card-title flex items-center gap-2">
            <Flag className="size-5" aria-hidden /> {p.posts}
          </h2>
          <FeedList initial={feed.items} nextCursor={feed.nextCursor} filter={{ authorId: profile.id }} isAdmin={viewer?.role === "ADMIN"} />
        </section>
      )}
    </div>
  );
}
