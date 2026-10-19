"use client";
import { useState } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { updateAppearance, updateProfile } from "@/actions/settings";
import { COLORS, colorVar } from "@/lib/colors";
import { cn } from "@/lib/cn";

type Appearance = {
  theme: "LIGHT" | "DARK" | "SYSTEM";
  accent: "ochre" | "jade" | "mist" | "rose";
  density: "comfortable" | "compact";
  locale: "vi" | "en";
};

const TIMEZONES = [
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export function AppearanceForm({ initial }: { initial: Appearance }) {
  const { t } = useI18n();
  const { exec } = useAction();
  const [v, setV] = useState(initial);

  /** Áp dụng ngay trên giao diện, lưu ngầm vào hồ sơ. */
  const change = <K extends keyof Appearance>(k: K, val: Appearance[K]) => {
    const next = { ...v, [k]: val };
    setV(next);
    const root = document.documentElement;
    if (k === "theme") root.dataset.theme = String(val).toLowerCase();
    if (k === "accent") root.dataset.accent = String(val);
    if (k === "density") root.dataset.density = String(val);
    exec(() => updateAppearance(next), { success: t.common.saved });
  };

  const themes = [
    { id: "LIGHT", icon: Sun },
    { id: "DARK", icon: Moon },
    { id: "SYSTEM", icon: Monitor },
  ] as const;

  return (
    <div className="mt-6 grid gap-7">
      <fieldset>
        <legend className="label mb-3">{t.settings.theme}</legend>
        <div className="grid grid-cols-3 gap-3">
          {themes.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={v.theme === id}
              onClick={() => change("theme", id)}
              className={cn(
                "group flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 text-left transition-colors",
                v.theme === id ? "border-ink" : "border-line hover:border-muted",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-20 items-end gap-1.5 p-3",
                  id === "LIGHT" && "bg-[#f5f3ee]",
                  id === "DARK" && "bg-[#111110]",
                  id === "SYSTEM" && "bg-[linear-gradient(135deg,#f5f3ee_50%,#111110_50%)]",
                )}
              >
                <span className={cn("h-8 w-10 rounded-lg", id === "DARK" ? "bg-[#23211e]" : "bg-white")} />
                <span className="h-5 w-6 rounded-md bg-accent" />
              </span>
              <span className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium">
                <Icon className="size-4 shrink-0" aria-hidden /> <span className="truncate">{t.settings.themes[id]}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label mb-3">{t.settings.accent}</legend>
        <div className="flex flex-wrap gap-3">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={v.accent === c}
              onClick={() => change("accent", c)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border-2 py-1.5 pl-1.5 pr-4 text-sm font-medium transition-colors",
                v.accent === c ? "border-ink" : "border-line hover:border-muted",
              )}
            >
              <span className="grid size-8 place-items-center rounded-full" style={{ background: colorVar(c) }}>
                {v.accent === c && <Check className="size-4 text-[#1d1c1a]" strokeWidth={3} aria-hidden />}
              </span>
              {t.settings.accents[c]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-7 sm:grid-cols-2">
        <fieldset>
          <legend className="label mb-3">{t.settings.density}</legend>
          <div className="segmented">
            {(["comfortable", "compact"] as const).map((d) => (
              <button key={d} type="button" aria-pressed={v.density === d} onClick={() => change("density", d)}>
                {t.settings.densities[d]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label mb-3">{t.settings.language}</legend>
          <div className="segmented">
            {(["vi", "en"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={v.locale === l} onClick={() => change("locale", l)}>
                {l === "vi" ? "Tiếng Việt" : "English"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

type Profile = {
  name: string;
  timezone: string;
  weekStartsOn: number;
  focusMinutes: number;
  breakMinutes: number;
  dailyFocusGoal: number;
};

export function ProfileForm({ initial }: { initial: Profile }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [v, setV] = useState(initial);
  const set = <K extends keyof Profile>(k: K, val: Profile[K]) => setV((p) => ({ ...p, [k]: val }));
  const zones = TIMEZONES.includes(v.timezone) ? TIMEZONES : [v.timezone, ...TIMEZONES];

  return (
    <form
      className="mt-5 grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => updateProfile(v), { success: t.common.saved });
      }}
    >
      <label className="field">
        <span className="label">{t.settings.displayName}</span>
        <input className="input" required maxLength={80} value={v.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span className="label">{t.settings.timezone}</span>
          <select className="input" value={v.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {zones.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{t.settings.weekStart}</span>
          <select className="input" value={v.weekStartsOn} onChange={(e) => set("weekStartsOn", Number(e.target.value))}>
            <option value={1}>{t.habits.weekdaysLong[1]}</option>
            <option value={0}>{t.habits.weekdaysLong[0]}</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["focusMinutes", t.settings.focusLen, 5, 180],
            ["breakMinutes", t.settings.breakLen, 1, 60],
            ["dailyFocusGoal", t.settings.dailyFocus, 0, 960],
          ] as const
        ).map(([k, label, min, max]) => (
          <label key={k} className="field content-end">
            <span className="label text-xs sm:text-sm">{label}</span>
            <input type="number" inputMode="numeric" className="input tabular" min={min} max={max} value={v[k]} onChange={(e) => set(k, Number(e.target.value))} />
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={pending}>
          {t.common.save}
        </button>
      </div>
    </form>
  );
}
