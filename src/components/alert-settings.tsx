"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Volume2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { loadPrefs, permission, requestPermission, savePrefs, systemNotify, type AlertPrefs } from "@/lib/notify";
import { playComplete, playReminder, unlockAudio } from "@/lib/sound";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

const LEADS = [0, 5, 10, 15];

function usePermission() {
  const [perm, setPerm] = useState<ReturnType<typeof permission> | null>(null);
  useEffect(() => setPerm(permission()), []);
  const ask = async () => {
    unlockAudio();
    const p = await requestPermission();
    setPerm(p);
    return p;
  };
  return { perm, ask };
}

/** Nút bật nhanh (Dashboard) — chỉ hiện khi người dùng chưa quyết định cấp quyền. */
export function EnableAlertsButton() {
  const { t } = useI18n();
  const { perm, ask } = usePermission();
  if (perm !== "default") return null;
  return (
    <button type="button" className="btn btn-soft btn-sm bg-ochre-soft text-ochre-ink" onClick={ask} title={t.alerts.enableHint}>
      <BellRing className="size-4" aria-hidden /> {t.alerts.enable}
    </button>
  );
}

export function AlertSettings() {
  const { t } = useI18n();
  const toast = useToast();
  const { perm, ask } = usePermission();
  const [prefs, setPrefs] = useState<AlertPrefs | null>(null);
  useEffect(() => setPrefs(loadPrefs()), []);
  const update = (p: Partial<AlertPrefs>) => {
    const next = { ...prefs!, ...p };
    setPrefs(next);
    savePrefs(next);
  };

  const test = async () => {
    unlockAudio();
    if (prefs?.sound) playReminder();
    const shown = systemNotify(t.alerts.testTitle, t.alerts.testBody, { tag: "test" });
    if (!shown) toast("success", t.alerts.testBody);
  };

  if (!prefs) return <div className="h-40" aria-hidden />;

  return (
    <div className="mt-5 grid gap-4">
      <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4", perm === "granted" ? "bg-jade-soft" : "bg-surface-2")}>
        <span className="flex items-center gap-3 text-sm font-medium">
          {perm === "granted" ? <Bell className="size-5 text-jade-ink" aria-hidden /> : <BellOff className="size-5 text-muted" aria-hidden />}
          {perm === "granted" ? t.alerts.enabled : perm === "denied" ? t.alerts.denied : perm === "unsupported" ? t.alerts.unsupported : t.alerts.enableHint}
        </span>
        {perm === "default" && (
          <button type="button" className="btn btn-primary btn-sm" onClick={ask}>
            {t.alerts.enable}
          </button>
        )}
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-surface-2 p-4">
        <span className="text-sm font-medium">{t.alerts.reminders}</span>
        <input type="checkbox" role="switch" className="size-5 accent-[var(--ink)]" checked={prefs.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
      </label>

      <fieldset disabled={!prefs.enabled} className="disabled:opacity-50">
        <legend className="label mb-2">{t.alerts.lead}</legend>
        <div className="segmented flex-wrap">
          {LEADS.map((m, i) => (
            <button key={m} type="button" aria-pressed={prefs.lead === m} onClick={() => update({ lead: m })}>
              {t.alerts.leadOptions[i]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-surface-2 p-4">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Volume2 className="size-4" aria-hidden /> {t.alerts.sound}
        </span>
        <input type="checkbox" role="switch" className="size-5 accent-[var(--ink)]" checked={prefs.sound} onChange={(e) => update({ sound: e.target.checked })} />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-soft" onClick={test}>
          <BellRing className="size-4" aria-hidden /> {t.alerts.test}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            unlockAudio();
            playComplete();
          }}
        >
          <Volume2 className="size-4" aria-hidden /> {t.alerts.focusDone}
        </button>
      </div>
      <p className="text-xs text-muted">{t.alerts.keepOpen}</p>
    </div>
  );
}
