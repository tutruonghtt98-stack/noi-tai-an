import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { AchievementEditor, DailyChallengeEditor, LevelEditor, MissionEditor, MonthlyEditor, QuoteEditor, RulesEditor, WeeklyEditor } from "./editor";

export const metadata: Metadata = { title: "Quản lý STILL / BETTER" };

export default async function AdminJourneyPage({ searchParams }: { searchParams: Promise<{ level?: string; day?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const program = await db.journeyProgram.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
    include: {
      levels: { orderBy: { number: "asc" }, include: { monthlyChallenge: true } },
      ruleSets: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  if (!program) {
    return <><PageHeader title="STILL / BETTER" subtitle="Chưa có chương trình được xuất bản." /><p className="py-8 text-sm text-muted">Chạy seed nội dung journey trên database đã migrate để bắt đầu quản lý.</p></>;
  }

  const levelNumber = Math.max(1, Math.min(6, Number(params.level) || 1));
  const level = program.levels.find((item) => item.number === levelNumber)!;
  const day = Math.max(1, Math.min(30, Number(params.day) || 1));
  const journeyDay = (level.number - 1) * 30 + day;
  const [missions, weeklyChallenges, dailyChallenge, quote, achievements] = await Promise.all([
    db.journeyMission.findMany({ where: { levelId: level.id, dayInLevel: day }, orderBy: { sequence: "asc" } }),
    db.journeyWeeklyChallenge.findMany({ where: { levelId: level.id }, orderBy: { weekNumber: "asc" } }),
    db.journeyDailyChallenge.findUnique({ where: { programId_journeyDay: { programId: program.id, journeyDay } } }),
    db.journeyQuote.findFirst({ where: { programId: program.id, dayNumber: journeyDay } }),
    db.journeyAchievementDefinition.findMany({ where: { programId: program.id }, orderBy: { code: "asc" } }),
  ]);
  const ruleSet = program.ruleSets[0];

  return (
    <>
      <PageHeader title="STILL / BETTER" subtitle={`${program.title} · v${program.version}`} />
      <section className="mb-6 flex flex-wrap gap-2" aria-label="Chọn Level">
        {program.levels.map((item) => <Link key={item.id} className={`btn btn-sm ${item.number === level.number ? "btn-primary" : "btn-soft"}`} href={`/admin/journey?level=${item.number}`}>L{String(item.number).padStart(2, "0")} {item.title}</Link>)}
      </section>
      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Chọn ngày">
        {Array.from({ length: 30 }, (_, index) => index + 1).map((number) => <Link key={number} className={`grid size-9 place-items-center rounded-lg border text-sm ${number === day ? "border-ink bg-ink text-bg" : "border-line hover:bg-surface-2"}`} href={`/admin/journey?level=${level.number}&day=${number}`}>{number}</Link>)}
      </nav>

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="mission-editor-title">
          <section className="mb-10 border-b border-line pb-8" aria-labelledby="level-content-title">
            <h2 id="level-content-title" className="mb-3 text-xl font-semibold">Nội dung Level {level.number}</h2>
            <LevelEditor level={{ ...level, skills: level.skills, reflectionQuestions: level.reflectionQuestions }} />
          </section>
          <div className="mb-2"><p className="text-xs font-semibold uppercase text-muted">DAY {(level.number - 1) * 30 + day} · {level.title}</p><h2 id="mission-editor-title" className="mt-1 text-xl font-semibold">Core Missions</h2></div>
          <div className="divide-y divide-line border-y border-line">
            {missions.map((mission) => <MissionEditor key={mission.id} mission={mission} />)}
          </div>
          {missions.length !== 3 && <p className="mt-3 text-sm text-danger">Cần đúng 3 mission cho ngày này; hiện có {missions.length}.</p>}

          <section className="mt-10" aria-labelledby="weekly-editor-title">
            <h2 id="weekly-editor-title" className="mb-3 text-xl font-semibold">Weekly Challenges</h2>
            <div className="divide-y divide-line border-y border-line">{weeklyChallenges.map((challenge) => <WeeklyEditor key={challenge.id} challenge={challenge} />)}</div>
          </section>
          {dailyChallenge && <section className="mt-10" aria-labelledby="daily-editor-title"><h2 id="daily-editor-title" className="mb-3 text-xl font-semibold">Daily Challenge · Day {journeyDay}</h2><DailyChallengeEditor challenge={{ ...dailyChallenge, journeyDay }} /></section>}
        </section>

        <aside className="grid content-start gap-8 border-t border-line pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          {level.monthlyChallenge && <section aria-labelledby="monthly-editor-title"><h2 id="monthly-editor-title" className="mb-3 text-lg font-semibold">Monthly Challenge</h2><MonthlyEditor challenge={{ ...level.monthlyChallenge, completionCriteria: Array.isArray(level.monthlyChallenge.completionCriteria) ? level.monthlyChallenge.completionCriteria.filter((item): item is string => typeof item === "string") : [] }} /></section>}
          {quote && <section aria-labelledby="quote-editor-title"><h2 id="quote-editor-title" className="mb-3 text-lg font-semibold">Daily Quote · Day {journeyDay}</h2><QuoteEditor quote={{ ...quote, dayNumber: journeyDay }} /></section>}
          {ruleSet && <section aria-labelledby="rules-editor-title"><h2 id="rules-editor-title" className="mb-3 text-lg font-semibold">Scoring Rules · v{ruleSet.version}</h2><RulesEditor ruleSet={ruleSet} /></section>}
          <section aria-labelledby="achievements-editor-title"><h2 id="achievements-editor-title" className="mb-3 text-lg font-semibold">Achievements</h2><div className="divide-y divide-line border-y border-line">{achievements.map((achievement) => <AchievementEditor key={achievement.id} achievement={achievement} />)}</div></section>
          <p className="text-xs leading-5 text-muted">Nội dung đã gán cho journey đang chạy được giữ theo snapshot. Thay đổi quy tắc tạo version mới. Mọi lần lưu đều có audit log.</p>
        </aside>
      </div>
    </>
  );
}