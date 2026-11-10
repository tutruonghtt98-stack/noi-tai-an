-- CreateEnum
CREATE TYPE "JourneyProgramStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "JourneyDayStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'REST', 'MISSED');

-- CreateEnum
CREATE TYPE "JourneyOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "JourneyMissionType" AS ENUM ('HEALTH', 'PERSONAL_GROWTH', 'PRODUCTIVITY', 'REFLECTION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "journeyOfferStatus" "JourneyOfferStatus";

-- CreateTable
CREATE TABLE "JourneyProgram" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "durationDays" INTEGER NOT NULL DEFAULT 180,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "JourneyProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyLevel" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startDay" INTEGER NOT NULL,
    "endDay" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "objective" TEXT NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reflectionQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completionCriteria" JSONB,
    "reportSections" JSONB,
    "completionThreshold" INTEGER NOT NULL DEFAULT 75,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyMission" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "dayInLevel" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "type" "JourneyMissionType" NOT NULL,
    "suggestedMinutes" INTEGER,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "completionCriteria" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyDailyChallenge" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "journeyDay" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "completionCriteria" TEXT NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyDailyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyWeeklyChallenge" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "startDay" INTEGER NOT NULL,
    "endDay" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "completionCriteria" TEXT NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyWeeklyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyMonthlyChallenge" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "completionCriteria" JSONB NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyMonthlyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyQuote" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "author" TEXT,
    "dayNumber" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyAchievementDefinition" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "levelId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "threshold" INTEGER,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyAchievementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyAchievement" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB,

    CONSTRAINT "JourneyAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyRuleSet" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "missionWeight" INTEGER NOT NULL DEFAULT 60,
    "habitWeight" INTEGER NOT NULL DEFAULT 20,
    "workspaceWeight" INTEGER NOT NULL DEFAULT 20,
    "levelCompletionThreshold" INTEGER NOT NULL DEFAULT 75,
    "earlyCompletionPoints" INTEGER NOT NULL DEFAULT 15,
    "onTimeCompletionPoints" INTEGER NOT NULL DEFAULT 10,
    "importantWorkBonus" INTEGER NOT NULL DEFAULT 5,
    "assignedAndCompletedSameDayBonus" INTEGER NOT NULL DEFAULT 5,
    "overdueFirstDayPenalty" INTEGER NOT NULL DEFAULT 5,
    "overdueAdditionalDayPenalty" INTEGER NOT NULL DEFAULT 2,
    "maxOverduePenalty" INTEGER,
    "importantLabel" TEXT NOT NULL DEFAULT 'IMPORTANT',
    "teamAssignmentPolicy" TEXT NOT NULL DEFAULT 'DIRECT_ONLY',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserJourney" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "status" "JourneyStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyDayRecord" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "journeyDay" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "status" "JourneyDayStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "dailyScore" INTEGER,
    "dailyChallengeId" TEXT,
    "dailyChallengeCompletedAt" TIMESTAMP(3),
    "restReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyDayRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyMissionCompletion" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "dayRecordId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyMissionCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyPersonalMission" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "dayRecordId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "suggestedMinutes" INTEGER,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyPersonalMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyReflection" (
    "id" TEXT NOT NULL,
    "dayRecordId" TEXT NOT NULL,
    "mood" INTEGER,
    "wins" TEXT,
    "lesson" TEXT,
    "gratitude" TEXT,
    "improvement" TEXT,
    "answers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyReflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyLevelReview" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "completionRate" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "answers" JSONB NOT NULL,
    "reportSnapshot" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyLevelReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyWeeklyChallengeCompletion" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyWeeklyChallengeCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyMonthlyChallengeCompletion" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyMonthlyChallengeCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkCardEvent" (
    "id" TEXT NOT NULL,
    "workCardId" TEXT,
    "workCardIdSnapshot" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "fromDueAt" TIMESTAMP(3),
    "toDueAt" TIMESTAMP(3),
    "fromAssigneeUserId" TEXT,
    "toAssigneeUserId" TEXT,
    "fromTeamId" TEXT,
    "toTeamId" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkCardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplineTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journeyId" TEXT,
    "workCardEventId" TEXT,
    "workCardIdSnapshot" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "eventType" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "dueAtSnapshot" TIMESTAMP(3),
    "completedAtSnapshot" TIMESTAMP(3),
    "statusSnapshot" TEXT,
    "assigneeUserIdSnapshot" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adjustmentOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplineTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyXPTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journeyId" TEXT,
    "missionCompletionId" TEXT,
    "eventType" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyXPTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyAdminAudit" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyAdminAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JourneyProgram_status_publishedAt_idx" ON "JourneyProgram"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyProgram_code_version_key" ON "JourneyProgram"("code", "version");

-- CreateIndex
CREATE INDEX "JourneyLevel_programId_idx" ON "JourneyLevel"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyLevel_programId_number_key" ON "JourneyLevel"("programId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyLevel_programId_slug_key" ON "JourneyLevel"("programId", "slug");

-- CreateIndex
CREATE INDEX "JourneyMission_levelId_dayInLevel_idx" ON "JourneyMission"("levelId", "dayInLevel");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyMission_levelId_dayInLevel_sequence_key" ON "JourneyMission"("levelId", "dayInLevel", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyDailyChallenge_programId_journeyDay_key" ON "JourneyDailyChallenge"("programId", "journeyDay");

-- CreateIndex
CREATE INDEX "JourneyWeeklyChallenge_levelId_weekNumber_idx" ON "JourneyWeeklyChallenge"("levelId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyWeeklyChallenge_programId_weekNumber_key" ON "JourneyWeeklyChallenge"("programId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyMonthlyChallenge_levelId_key" ON "JourneyMonthlyChallenge"("levelId");

-- CreateIndex
CREATE INDEX "JourneyQuote_programId_dayNumber_active_idx" ON "JourneyQuote"("programId", "dayNumber", "active");

-- CreateIndex
CREATE INDEX "JourneyAchievementDefinition_levelId_active_idx" ON "JourneyAchievementDefinition"("levelId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyAchievementDefinition_programId_code_key" ON "JourneyAchievementDefinition"("programId", "code");

-- CreateIndex
CREATE INDEX "JourneyAchievement_journeyId_awardedAt_idx" ON "JourneyAchievement"("journeyId", "awardedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyAchievement_journeyId_definitionId_key" ON "JourneyAchievement"("journeyId", "definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyRuleSet_programId_version_key" ON "JourneyRuleSet"("programId", "version");

-- CreateIndex
CREATE INDEX "UserJourney_userId_status_idx" ON "UserJourney"("userId", "status");

-- CreateIndex
CREATE INDEX "UserJourney_programId_status_idx" ON "UserJourney"("programId", "status");

-- CreateIndex
CREATE INDEX "JourneyDayRecord_journeyId_journeyDay_idx" ON "JourneyDayRecord"("journeyId", "journeyDay");

-- CreateIndex
CREATE INDEX "JourneyDayRecord_journeyId_status_idx" ON "JourneyDayRecord"("journeyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyDayRecord_journeyId_date_key" ON "JourneyDayRecord"("journeyId", "date");

-- CreateIndex
CREATE INDEX "JourneyMissionCompletion_dayRecordId_completedAt_idx" ON "JourneyMissionCompletion"("dayRecordId", "completedAt");

-- CreateIndex
CREATE INDEX "JourneyMissionCompletion_missionId_completedAt_idx" ON "JourneyMissionCompletion"("missionId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyMissionCompletion_journeyId_missionId_key" ON "JourneyMissionCompletion"("journeyId", "missionId");

-- CreateIndex
CREATE INDEX "JourneyPersonalMission_journeyId_dayRecordId_idx" ON "JourneyPersonalMission"("journeyId", "dayRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyReflection_dayRecordId_key" ON "JourneyReflection"("dayRecordId");

-- CreateIndex
CREATE INDEX "JourneyLevelReview_journeyId_submittedAt_idx" ON "JourneyLevelReview"("journeyId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyLevelReview_journeyId_levelId_key" ON "JourneyLevelReview"("journeyId", "levelId");

-- CreateIndex
CREATE INDEX "JourneyWeeklyChallengeCompletion_journeyId_completedAt_idx" ON "JourneyWeeklyChallengeCompletion"("journeyId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyWeeklyChallengeCompletion_journeyId_challengeId_key" ON "JourneyWeeklyChallengeCompletion"("journeyId", "challengeId");

-- CreateIndex
CREATE INDEX "JourneyMonthlyChallengeCompletion_journeyId_completedAt_idx" ON "JourneyMonthlyChallengeCompletion"("journeyId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyMonthlyChallengeCompletion_journeyId_challengeId_key" ON "JourneyMonthlyChallengeCompletion"("journeyId", "challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkCardEvent_idempotencyKey_key" ON "WorkCardEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WorkCardEvent_workCardIdSnapshot_occurredAt_idx" ON "WorkCardEvent"("workCardIdSnapshot", "occurredAt");

-- CreateIndex
CREATE INDEX "WorkCardEvent_actorUserId_occurredAt_idx" ON "WorkCardEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplineTransaction_idempotencyKey_key" ON "DisciplineTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DisciplineTransaction_userId_occurredAt_idx" ON "DisciplineTransaction"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "DisciplineTransaction_journeyId_occurredAt_idx" ON "DisciplineTransaction"("journeyId", "occurredAt");

-- CreateIndex
CREATE INDEX "DisciplineTransaction_workCardIdSnapshot_occurredAt_idx" ON "DisciplineTransaction"("workCardIdSnapshot", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyXPTransaction_missionCompletionId_key" ON "JourneyXPTransaction"("missionCompletionId");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyXPTransaction_idempotencyKey_key" ON "JourneyXPTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "JourneyXPTransaction_userId_occurredAt_idx" ON "JourneyXPTransaction"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyXPTransaction_journeyId_occurredAt_idx" ON "JourneyXPTransaction"("journeyId", "occurredAt");

-- CreateIndex
CREATE INDEX "JourneyAdminAudit_adminId_createdAt_idx" ON "JourneyAdminAudit"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "JourneyAdminAudit_entityType_entityId_idx" ON "JourneyAdminAudit"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "JourneyLevel" ADD CONSTRAINT "JourneyLevel_programId_fkey" FOREIGN KEY ("programId") REFERENCES "JourneyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyMission" ADD CONSTRAINT "JourneyMission_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "JourneyLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyDailyChallenge" ADD CONSTRAINT "JourneyDailyChallenge_programId_fkey" FOREIGN KEY ("programId") REFERENCES "JourneyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyWeeklyChallenge" ADD CONSTRAINT "JourneyWeeklyChallenge_programId_fkey" FOREIGN KEY ("programId") REFERENCES "JourneyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyWeeklyChallenge" ADD CONSTRAINT "JourneyWeeklyChallenge_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "JourneyLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyMonthlyChallenge" ADD CONSTRAINT "JourneyMonthlyChallenge_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "JourneyLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyQuote" ADD CONSTRAINT "JourneyQuote_programId_fkey" FOREIGN KEY ("programId") REFERENCES "JourneyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyAchievementDefinition" ADD CONSTRAINT "JourneyAchievementDefinition_programId_fkey" FOREIGN KEY ("programId") REFERENCES "JourneyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyAchievementDefinition" ADD CONSTRAINT "JourneyAchievementDefinition_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "JourneyLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyAchievement" ADD CONSTRAINT "JourneyAchievement_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyAchievement" ADD CONSTRAINT "JourneyAchievement_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "JourneyAchievementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyRuleSet" ADD CONSTRAINT "JourneyRuleSet_programId_fkey" FOREIGN KEY ("programId") REFERENCES "JourneyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserJourney" ADD CONSTRAINT "UserJourney_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserJourney" ADD CONSTRAINT "UserJourney_programId_fkey" FOREIGN KEY ("programId") REFERENCES "JourneyProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserJourney" ADD CONSTRAINT "UserJourney_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "JourneyRuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyDayRecord" ADD CONSTRAINT "JourneyDayRecord_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyDayRecord" ADD CONSTRAINT "JourneyDayRecord_dailyChallengeId_fkey" FOREIGN KEY ("dailyChallengeId") REFERENCES "JourneyDailyChallenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyMissionCompletion" ADD CONSTRAINT "JourneyMissionCompletion_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyMissionCompletion" ADD CONSTRAINT "JourneyMissionCompletion_dayRecordId_fkey" FOREIGN KEY ("dayRecordId") REFERENCES "JourneyDayRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyMissionCompletion" ADD CONSTRAINT "JourneyMissionCompletion_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "JourneyMission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyPersonalMission" ADD CONSTRAINT "JourneyPersonalMission_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyPersonalMission" ADD CONSTRAINT "JourneyPersonalMission_dayRecordId_fkey" FOREIGN KEY ("dayRecordId") REFERENCES "JourneyDayRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyReflection" ADD CONSTRAINT "JourneyReflection_dayRecordId_fkey" FOREIGN KEY ("dayRecordId") REFERENCES "JourneyDayRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyLevelReview" ADD CONSTRAINT "JourneyLevelReview_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyLevelReview" ADD CONSTRAINT "JourneyLevelReview_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "JourneyLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyWeeklyChallengeCompletion" ADD CONSTRAINT "JourneyWeeklyChallengeCompletion_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyWeeklyChallengeCompletion" ADD CONSTRAINT "JourneyWeeklyChallengeCompletion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "JourneyWeeklyChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyMonthlyChallengeCompletion" ADD CONSTRAINT "JourneyMonthlyChallengeCompletion_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyMonthlyChallengeCompletion" ADD CONSTRAINT "JourneyMonthlyChallengeCompletion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "JourneyMonthlyChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCardEvent" ADD CONSTRAINT "WorkCardEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineTransaction" ADD CONSTRAINT "DisciplineTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineTransaction" ADD CONSTRAINT "DisciplineTransaction_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineTransaction" ADD CONSTRAINT "DisciplineTransaction_workCardEventId_fkey" FOREIGN KEY ("workCardEventId") REFERENCES "WorkCardEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplineTransaction" ADD CONSTRAINT "DisciplineTransaction_adjustmentOfId_fkey" FOREIGN KEY ("adjustmentOfId") REFERENCES "DisciplineTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyXPTransaction" ADD CONSTRAINT "JourneyXPTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyXPTransaction" ADD CONSTRAINT "JourneyXPTransaction_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyXPTransaction" ADD CONSTRAINT "JourneyXPTransaction_missionCompletionId_fkey" FOREIGN KEY ("missionCompletionId") REFERENCES "JourneyMissionCompletion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyAdminAudit" ADD CONSTRAINT "JourneyAdminAudit_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
