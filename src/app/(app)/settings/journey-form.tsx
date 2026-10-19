"use client";
import Link from "next/link";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { updateJourney, type JourneyInput } from "@/actions/profile";

function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl bg-surface-2 p-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {desc && <span className="mt-0.5 block text-xs text-muted">{desc}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-surface-3 transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function JourneyForm({ initial, suggested }: { initial: JourneyInput & { username: string }; suggested: string }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [f, setF] = useState({ ...initial, username: initial.username || suggested, bio: initial.bio ?? "" });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const p = t.community.profile;

  return (
    <form
      className="mt-5 grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => updateJourney(f), { success: t.common.saved });
      }}
    >
      <label className="field">
        <span className="label">{p.username}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">/u/</span>
          <input
            className="input font-mono"
            required
            pattern="[a-z0-9_]{3,24}"
            maxLength={24}
            value={f.username}
            onChange={(e) => set("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            aria-describedby="uname-hint"
          />
        </div>
        <span id="uname-hint" className="text-xs text-muted">
          {p.usernameHint}
        </span>
      </label>
      <label className="field">
        <span className="label">{p.bio}</span>
        <textarea className="input min-h-20" maxLength={280} value={f.bio} placeholder={p.bioPh} onChange={(e) => set("bio", e.target.value)} />
      </label>
      <Toggle label={p.public} desc={p.publicDesc} checked={f.profilePublic} onChange={(v) => set("profilePublic", v)} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle label={p.showGoals} checked={f.showGoals} onChange={(v) => set("showGoals", v)} />
        <Toggle label={p.showStats} checked={f.showStats} onChange={(v) => set("showStats", v)} />
        <Toggle label={p.showBadges} checked={f.showBadges} onChange={(v) => set("showBadges", v)} />
        <Toggle label={p.showChallenges} checked={f.showChallenges} onChange={(v) => set("showChallenges", v)} />
      </div>
      <Toggle label={p.leaderboard} checked={f.leaderboardOptIn} onChange={(v) => set("leaderboardOptIn", v)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {initial.username ? (
          <Link href={`/u/${initial.username}`} className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
            {p.view} <ExternalLink className="size-4" aria-hidden />
          </Link>
        ) : (
          <span />
        )}
        <button className="btn btn-primary" disabled={pending}>
          {t.common.save}
        </button>
      </div>
    </form>
  );
}
