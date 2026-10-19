import type { Metadata } from "next";
import Link from "next/link";
import { Info, Medal } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { db } from "@/lib/db";
import { formatDate, startOfWeek, todayISO, addDays } from "@/lib/dates";
import { weeklyLeaderboard } from "@/lib/leaderboard";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Bảng xếp hạng" };
export const dynamic = "force-dynamic";

const MEDAL = ["var(--ochre)", "#c9ccd1", "#d39b6a"];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const today = todayISO(user.timezone);
  const weekStart = startOfWeek(today, user.weekStartsOn);

  const myChallenges = await db.challengeMember.findMany({ where: { userId: user.id }, include: { challenge: { select: { id: true, title: true, durationDays: true } } }, take: 20 });
  const selected = sp.challenge ? myChallenges.find((m) => m.challengeId === sp.challenge)?.challenge : null;

  let rows: { userId: string; name: string; image: string | null; username: string | null; cols: [string, string, string]; score: number }[] = [];
  if (selected) {
    const ranking = await db.challengeCheckin.groupBy({ by: ["userId"], where: { challengeId: selected.id }, _count: true, orderBy: { _count: { userId: "desc" } }, take: 100 });
    const people = await db.user.findMany({
      where: { id: { in: ranking.map((r) => r.userId) }, bannedAt: null, OR: [{ leaderboardOptIn: true }, { id: user.id }] },
      select: { id: true, name: true, image: true, username: true, profilePublic: true },
    });
    rows = ranking
      .filter((r) => people.some((p) => p.id === r.userId))
      .map((r) => {
        const p = people.find((x) => x.id === r.userId)!;
        const pct = r._count / selected.durationDays;
        return { userId: p.id, name: p.name ?? "—", image: p.image, username: p.profilePublic ? p.username : null, cols: [`${Math.round(pct * 100)}%`, `${r._count}/${selected.durationDays}`, "—"], score: Math.round(pct * 100) };
      });
  } else {
    const board = await weeklyLeaderboard(weekStart, today, user.id);
    rows = board.map((b) => ({
      userId: b.userId,
      name: b.name,
      image: b.image,
      username: b.username,
      cols: [`${Math.round(b.completion * 100)}%`, `${b.checkinDays}/7`, fmt(t.community.board.streakDays, { n: b.streak })],
      score: b.score,
    }));
  }

  return (
    <div className="grid grid-cols-1 gap-[var(--gap)]">
      <section className="card hero-glow">
        <h2 className="card-title">{t.community.board.title}</h2>
        <p className="mt-2 flex gap-2 text-sm text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t.community.board.desc}
        </p>
        {!user.leaderboardOptIn && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm text-muted">{t.community.board.optOut}</p>}
        <nav className="no-scrollbar mt-5 flex gap-1.5 overflow-x-auto" aria-label={t.community.board.pickChallenge}>
          <Link href="/community/leaderboard" aria-current={!selected ? "page" : undefined} className="shrink-0 rounded-full bg-surface-2 px-4 py-2 text-sm font-medium aria-[current=page]:bg-ink aria-[current=page]:text-bg">
            {t.community.board.week} · {formatDate(weekStart, locale, { day: "numeric", month: "numeric" })}–{formatDate(addDays(weekStart, 6), locale, { day: "numeric", month: "numeric" })}
          </Link>
          {myChallenges.map((m) => (
            <Link
              key={m.challengeId}
              href={`/community/leaderboard?challenge=${m.challengeId}`}
              aria-current={selected?.id === m.challengeId ? "page" : undefined}
              className="max-w-60 shrink-0 truncate rounded-full bg-surface-2 px-4 py-2 text-sm font-medium aria-[current=page]:bg-ink aria-[current=page]:text-bg"
            >
              {m.challenge.title}
            </Link>
          ))}
        </nav>
      </section>

      <section className="card min-w-0" aria-label={t.community.board.title}>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{t.community.board.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-ink-2">
                <tr className="border-b border-line">
                  <th className="w-14 py-3 pr-2 font-medium">{t.community.board.rank}</th>
                  <th className="py-3 pr-4 font-medium">{t.community.board.member}</th>
                  <th className="py-3 pr-4 text-right font-medium">{t.community.board.completion}</th>
                  <th className="py-3 pr-4 text-right font-medium">{t.community.board.checkinDays}</th>
                  <th className="py-3 pr-4 text-right font-medium">{t.community.board.persistence}</th>
                  <th className="py-3 text-right font-medium">{t.community.board.score}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const me = r.userId === user.id;
                  return (
                    <tr key={r.userId} className={cn("border-b border-line last:border-0", me && "bg-accent-soft/60")}>
                      <td className="py-3 pr-2">
                        {i < 3 ? (
                          <span className="grid size-8 place-items-center rounded-full" style={{ background: MEDAL[i] }}>
                            <Medal className="size-4 text-[#1d1c1a]" aria-label={`#${i + 1}`} />
                          </span>
                        ) : (
                          <span className="tabular pl-2.5 font-semibold text-muted">{i + 1}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="flex items-center gap-3">
                          <Avatar name={r.name} image={r.image} size={36} />
                          {r.username ? (
                            <Link href={`/u/${r.username}`} className="font-medium hover:underline">
                              {r.name}
                            </Link>
                          ) : (
                            <span className="font-medium">{r.name}</span>
                          )}
                          {me && <span className="badge bg-ink text-bg">{t.community.board.you}</span>}
                        </span>
                      </td>
                      <td className="tabular py-3 pr-4 text-right">{r.cols[0]}</td>
                      <td className="tabular py-3 pr-4 text-right">{r.cols[1]}</td>
                      <td className="tabular py-3 pr-4 text-right">{r.cols[2]}</td>
                      <td className="tabular py-3 text-right text-base font-semibold">{r.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
