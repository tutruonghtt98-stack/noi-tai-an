import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Flame, Quote, Target, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getJourneyDashboard } from "@/lib/journey-queries";
import { syncOverdueDiscipline } from "@/lib/journey-score-ledger";
import { PageHeader } from "@/components/page-header";
import { JourneyWeeklyChallengeActions, JourneyControls, JourneyReflectionCard, StartJourneyButton } from "./journey-controls";
import { ProgressBar, ProgressRing } from "@/components/ui/progress-ring";
import { CountUp } from "@/components/ui/count-up";
import { SplitChars } from "@/components/ui/split-chars";
import { Empty } from "@/components/ui/empty";
import { StaggerReveal } from "@/components/ui/stagger-reveal";
import { weeklyCommitmentOptions, getCommittedWakeTime } from "@/lib/journey-goal-domains";
import { JourneyMidnightRefresh } from "./midnight-refresh";
import { getI18n } from "@/lib/i18n";

export const metadata: Metadata = { title: "Hành trình 180 ngày" };

function AsideCardHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold uppercase text-muted">{eyebrow}</p>
      <h2 className="mt-1 card-title text-base">{title}</h2>
    </div>
  );
}

export default async function JourneyPage() {
  const user = await requireUser();
  const { t } = await getI18n();
  await syncOverdueDiscipline(user.id);
  const journey = await getJourneyDashboard(user);

  if (!journey) {
    return (
      <>
        <PageHeader title="Hành trình 180 ngày" subtitle="STILL / BETTER · Một thay đổi nhỏ, lặp lại theo nhịp của bạn." />
        <div className="card">
          <Empty icon={Compass} text="Lời mời tham gia xuất hiện sau khi tạo tài khoản. Nếu bạn đã bỏ qua, bạn vẫn có thể bắt đầu bất cứ lúc nào ở đây.">
            <div className="flex flex-wrap justify-center gap-2">
              <StartJourneyButton />
              <Link href="/dashboard" className="btn btn-soft">Về tổng quan</Link>
            </div>
          </Empty>
        </div>
      </>
    );
  }

  if (journey.journey.status === "COMPLETED") {
    const [xp, discipline, completedDays] = await Promise.all([
      db.journeyXPTransaction.aggregate({ where: { journeyId: journey.journey.id }, _sum: { xp: true } }),
      db.disciplineTransaction.aggregate({ where: { journeyId: journey.journey.id }, _sum: { points: true } }),
      db.journeyDayRecord.count({ where: { journeyId: journey.journey.id, status: "COMPLETED" } }),
    ]);
    return (
      <>
        <PageHeader
          title="STILL / BETTER · Đã hoàn thành"
          subtitle="180 ngày thay đổi, được xây bằng những lựa chọn lặp lại mỗi ngày."
          action={<span className="badge inline-flex items-center gap-2"><Trophy className="size-3.5" aria-hidden /> Hoàn thành hành trình</span>}
        />
        <section className="card hero-glow grid grid-cols-1 gap-6 sm:grid-cols-3" aria-label="Báo cáo hoàn thành">
          <div>
            <p className="text-xs uppercase text-muted">Ngày hoàn thành</p>
            <p className="tabular mt-2 text-4xl font-semibold tracking-tight"><CountUp value={completedDays} />/180</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">{t.journey.disciplinePoints}</p>
            <p className="tabular mt-2 text-4xl font-semibold tracking-tight"><CountUp value={discipline._sum.points ?? 0} /></p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted">{t.journey.journeyXp}</p>
            <p className="tabular mt-2 text-4xl font-semibold tracking-tight"><CountUp value={xp._sum.xp ?? 0} /></p>
          </div>
        </section>
        <section className="card mt-[var(--gap)]" aria-labelledby="certificate-achievements">
          <h2 id="certificate-achievements" className="card-title">
            <SplitChars text="Thành tích đạt được" />
          </h2>
          {journey.achievements.length ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {journey.achievements.map((award) => (
                <li key={award.id} className="rounded-2xl bg-surface-2 p-4">
                  <p className="font-medium">{award.definition.title}</p>
                  <p className="mt-1 text-sm text-ink-2">{award.definition.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={Trophy} text="Hành trình đã hoàn thành." />
          )}
        </section>
      </>
    );
  }

  if (!journey.level || !journey.dayRecord) {
    return <PageHeader title="Hành trình 180 ngày" subtitle="Chưa có nội dung cho ngày hiện tại." />;
  }

  const dayNumber = Math.min(journey.journey.currentDay, journey.journey.program.durationDays);
  const progress = Math.round(((dayNumber - 1) / journey.journey.program.durationDays) * 100);
  const [xp, discipline, completedDays, quote] = await Promise.all([
    db.journeyXPTransaction.aggregate({ where: { journeyId: journey.journey.id }, _sum: { xp: true } }),
    db.disciplineTransaction.aggregate({ where: { journeyId: journey.journey.id }, _sum: { points: true } }),
    db.journeyDayRecord.count({ where: { journeyId: journey.journey.id, status: "COMPLETED" } }),
    db.journeyQuote.findFirst({
      where: { programId: journey.journey.programId, active: true, OR: [{ dayNumber }, { dayNumber: null }] },
      orderBy: { dayNumber: "desc" },
    }),
  ]);
  const missions = journey.missions.map((mission) => ({
    id: mission.id,
    title: mission.title,
    description: mission.description,
    objective: mission.objective,
    suggestedMinutes: mission.suggestedMinutes,
    xpReward: mission.xpReward,
    completionCriteria: mission.completionCriteria,
    completed: mission.completions.length > 0,
  }));
  const missionsDone = missions.filter((m) => m.completed).length;

  return (
    <>
      <JourneyMidnightRefresh timezone={journey.journey.timezone} today={journey.today} />
      <PageHeader
        title={`${journey.level.title} · Ngày ${dayNumber}`}
        subtitle={journey.level.objective}
        action={<span className="badge inline-flex items-center gap-2"><Flame className="size-3.5" aria-hidden /> {t.journey.level} {String(journey.level.number).padStart(2, "0")}</span>}
      />

      <section className="card hero-glow flex flex-col gap-6 lg:flex-row lg:items-center" aria-label="Tiến độ hành trình">
        <div className="flex items-center gap-5">
          <ProgressRing value={progress / 100} size={84} stroke={9} label="Tiến trình 180 ngày">
            <span className="tabular text-lg font-semibold">{dayNumber}</span>
          </ProgressRing>
          <div>
            <p className="text-xs uppercase text-muted">Tiến trình 180 ngày</p>
            <p className="tabular mt-1 text-2xl font-semibold">{dayNumber}<span className="text-base font-normal text-muted">/180</span></p>
            <div className="mt-3 w-48"><ProgressBar value={progress / 100} label="Tiến trình 180 ngày" /></div>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap gap-2.5 lg:justify-end">
          <span className="chip"><span className="chip-num tabular">{missionsDone}/{missions.length}</span> mission hôm nay</span>
          <span className="chip"><span className="chip-num tabular">{journey.dailyScore}</span> điểm ngày</span>
          <span className="chip"><span className="chip-num tabular">{completedDays}</span> ngày hoàn thành</span>
        </div>
      </section>

      <section className="card mt-[var(--gap)] grid grid-cols-2 gap-3 p-3 sm:p-4 lg:grid-cols-4" aria-label="Chỉ số hành trình">
        <div className="rounded-[1.5rem] bg-ink p-5 text-bg">
          <p className="text-sm font-medium opacity-70">Ngày hoàn thành</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight"><CountUp value={completedDays} /></p>
          <p className="mt-3 text-sm opacity-70">trên tổng 180 ngày</p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{t.journey.disciplinePoints}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight"><CountUp value={discipline._sum.points ?? 0} /></p>
          <p className="mt-3 text-sm text-muted">từ dữ liệu Workspace</p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{t.journey.journeyXp}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight"><CountUp value={xp._sum.xp ?? 0} /></p>
          <p className="mt-3 text-sm text-muted">từ mission &amp; thử thách</p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-2 p-5">
          <p className="text-sm font-medium text-ink-2">{t.journey.dailyScoreLabel}</p>
          <p className="tabular mt-4 text-4xl font-semibold tracking-tight"><CountUp value={journey.dailyScore} suffix="%" /></p>
          <p className="mt-3 text-sm text-muted">mission, thói quen, Workspace</p>
        </div>
      </section>

      <div className="mt-[var(--gap)] grid gap-[var(--gap)] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <StaggerReveal asChild={false} slide={{ direction: "up", offset: 16 }} holdDelay={60}>
          <JourneyControls
            missions={missions}
            recoveryMissions={journey.recoveryMissions.map((mission) => ({
              id: mission.id,
              title: mission.title,
              description: mission.description,
              objective: mission.objective,
              suggestedMinutes: mission.suggestedMinutes,
              xpReward: mission.xpReward,
              completionCriteria: mission.completionCriteria,
              completed: false,
              dayInLevel: mission.dayInLevel,
            }))}
            personalMissions={journey.personalMissions}
            dailyChallenge={journey.dailyChallenge ? {
              title: journey.dailyChallenge.title,
              description: journey.dailyChallenge.description,
              completionCriteria: journey.dailyChallenge.completionCriteria,
              xpReward: journey.dailyChallenge.xpReward,
              completed: !!journey.dayRecord.dailyChallengeCompletedAt,
            } : null}
            expense={journey.dayRecord.expense ? { amountVnd: journey.dayRecord.expense.amountVnd, note: journey.dayRecord.expense.note } : null}
            dayStatus={journey.dayRecord.status}
            isLevelEnd={dayNumber === journey.level.endDay}
            levelQuestions={journey.level.reflectionQuestions}
            levelReview={journey.levelReview}
            wakeTime={getCommittedWakeTime(journey.journey.commitments)}
            habits={journey.habits}
            today={journey.today}
            weeklyCommitments={weeklyCommitmentOptions(journey.journey.commitments).map((g) => ({
              ...g,
              done: journey.completedWeeklyOptionIds.includes(g.optionId),
            }))}
          />
        </StaggerReveal>

        <StaggerReveal slide={{ direction: "up", offset: 16 }} holdDelay={60}>
          <aside className="grid content-start gap-[var(--gap)]">
            <section className="card" aria-labelledby="weekly-challenge">
              <AsideCardHead eyebrow={t.journey.weeklyChallengeEyebrow} title={journey.weeklyChallenge?.title ?? "Chưa có thử thách tuần"} />
              {journey.weeklyChallenge && (
                <>
                  <p className="text-sm leading-6 text-ink-2">{journey.weeklyChallenge.description}</p>
                  <JourneyWeeklyChallengeActions
                    weekly={{
                      title: journey.weeklyChallenge.title,
                      completed: !!journey.weeklyChallenge.completions[0]?.completedAt,
                      personalCommitments: weeklyCommitmentOptions(journey.journey.commitments).map((g) => ({
                        label: g.label,
                        done: journey.completedWeeklyOptionIds.includes(g.optionId),
                      })),
                      wakeTime: getCommittedWakeTime(journey.journey.commitments),
                    }}
                  />
                </>
              )}
            </section>

            <section className="card" aria-labelledby="daily-quote">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted">
                <Quote className="size-3.5" aria-hidden /> {t.journey.todayEyebrow}
              </div>
              <blockquote id="daily-quote" className="mt-2 text-sm leading-6 text-ink-2">
                “{quote?.quote ?? "Một bước nhỏ có chủ đích vẫn là một bước tiến."}”
              </blockquote>
            </section>

            <section className="card" aria-labelledby="journey-workspace">
              <AsideCardHead eyebrow={t.journey.workspaceTasksEyebrow} title="Việc được giao hôm nay" />
              {journey.workspaceCards.length ? (
                <ul className="divide-y divide-line border-y border-line">
                  {journey.workspaceCards.map((card) => (
                    <li key={card.id}>
                      <Link href={`/workspace?b=${card.list.board.id}&card=${card.id}`} className="block py-2 text-sm hover:underline">
                        <span className="font-medium">{card.title}</span>
                        <span className="mt-0.5 block text-xs text-muted">{card.list.board.name} · {card.list.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Không có task Workspace trực tiếp được giao đến hạn hôm nay.</p>
              )}
              <Link href="/workspace" className="mt-3 inline-flex text-sm font-medium underline underline-offset-4">Mở Workspace</Link>
            </section>

            <JourneyReflectionCard dayScore={journey.dailyScore} reflection={journey.dayRecord.reflection} dayStatus={journey.dayRecord.status} />

            <section className="card" aria-labelledby="journey-achievements">
              <AsideCardHead eyebrow={t.journey.achievementsEyebrow} title="Thành tích đã đạt" />
              {journey.achievements.length ? (
                <ul className="grid gap-3">
                  {journey.achievements.map((award) => (
                    <li key={award.id} className="rounded-xl bg-surface-2 p-3">
                      <p className="text-sm font-medium">{award.definition.title}</p>
                      <p className="mt-1 text-xs text-muted">{award.definition.description}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon={Target} text="Thành tích sẽ được ghi nhận khi đạt điều kiện." />
              )}
            </section>
          </aside>
        </StaggerReveal>
      </div>
    </>
  );
}
