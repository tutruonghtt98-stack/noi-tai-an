import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { effectivePlan } from "@/lib/plan";
import { PageHeader } from "@/components/page-header";
import { AppearanceForm, ProfileForm } from "./forms";
import { JourneyForm } from "./journey-form";
import { AlertSettings } from "@/components/alert-settings";
import { AvatarUploader } from "@/components/community/avatar-uploader";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const plan = effectivePlan(user);

  return (
    <>
      <PageHeader title={t.settings.title} />
      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="card" aria-labelledby="appearance">
          <h2 id="appearance" className="card-title">
            {t.settings.appearance}
          </h2>
          <p className="mt-1 text-sm text-ink-2">{t.settings.appearanceSub}</p>
          <AppearanceForm
            initial={{
              theme: user.theme,
              accent: user.accent as "ochre",
              density: user.density as "comfortable",
              locale: locale,
            }}
          />
        </section>

        <div className="grid min-w-0 grid-cols-1 content-start gap-[var(--gap)]">
          <section className="card" aria-labelledby="plan">
            <h2 id="plan" className="card-title">
              {t.settings.plan}
            </h2>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-soft p-4">
              <div>
                <p className="text-2xl font-semibold">
                  {plan === "FREE" ? t.settings.planFree : plan === "PRO" ? t.settings.planPro : t.settings.planTeam}
                </p>
                {user.planExpiresAt && plan !== "FREE" && (
                  <p className="text-sm text-accent-ink">
                    {t.settings.expires.replace("{d}", user.planExpiresAt.toISOString().slice(0, 10))}
                  </p>
                )}
              </div>
              <Link href={plan === "FREE" ? "/pricing" : "/billing"} className="btn btn-primary btn-sm">
                {plan === "FREE" ? t.common.upgrade : t.billing.manage}
              </Link>
            </div>
          </section>

          <section className="card" aria-labelledby="profile">
            <h2 id="profile" className="card-title">
              {t.settings.profile} · {t.settings.work}
            </h2>
            <div className="mt-4">
              <AvatarUploader name={user.name ?? "?"} image={user.image} size={72} showRemove />
            </div>
            <ProfileForm
              initial={{
                name: user.name ?? "",
                timezone: user.timezone,
                weekStartsOn: user.weekStartsOn,
                focusMinutes: user.focusMinutes,
                breakMinutes: user.breakMinutes,
                dailyFocusGoal: user.dailyFocusGoal,
              }}
            />
          </section>

          <section className="card scroll-mt-6" id="alerts" aria-labelledby="alerts-h">
            <h2 id="alerts-h" className="card-title">
              {t.alerts.title}
            </h2>
            <p className="mt-1 text-sm text-ink-2">{t.alerts.desc}</p>
            <AlertSettings />
          </section>

          <section className="card scroll-mt-6" id="journey" aria-labelledby="journey-h">
            <h2 id="journey-h" className="card-title">
              {t.community.profile.title}
            </h2>
            <JourneyForm
              suggested={(user.email ?? "ban").split("@")[0]!.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20).padEnd(3, "0")}
              initial={{
                username: user.username ?? "",
                bio: user.bio ?? "",
                profilePublic: user.profilePublic,
                showGoals: user.showGoals,
                showStats: user.showStats,
                showBadges: user.showBadges,
                showChallenges: user.showChallenges,
                leaderboardOptIn: user.leaderboardOptIn,
                autoShareAchievements: user.autoShareAchievements,
              }}
            />
          </section>

          <section className="card" aria-labelledby="data">
            <h2 id="data" className="card-title">
              {t.settings.data}
            </h2>
            <a href="/api/export" className="btn btn-soft mt-4" download>
              {t.settings.exportData}
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
