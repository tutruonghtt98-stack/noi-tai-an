"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { saveJournal, saveWeeklyReview, type JournalInput, type WeeklyInput } from "@/actions/reflection";
import { CAUSES, type Cause } from "@/lib/reflection";
import { cn } from "@/lib/cn";

const MOODS = [1, 2, 3, 4, 5] as const;

function Area({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <textarea className="input" rows={rows} value={value} placeholder={placeholder} maxLength={3000} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function JournalForm({ date, initial, locked }: { date: string; initial: JournalInput; locked: boolean }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [f, setF] = useState({
    mood: initial.mood ?? null,
    wins: initial.wins ?? "",
    lessons: initial.lessons ?? "",
    gratitude: initial.gratitude ?? "",
    tomorrow: initial.tomorrow ?? "",
    procrastination: (initial.procrastination ?? []) as Cause[],
    procrastinationNote: initial.procrastinationNote ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggleCause = (c: Cause) =>
    set("procrastination", f.procrastination.includes(c) ? f.procrastination.filter((x) => x !== c) : [...f.procrastination, c]);

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => saveJournal(date, f), { success: t.common.saved });
      }}
    >
      <fieldset disabled={locked} className="grid gap-5 disabled:opacity-60">
        <div>
          <span className="label" id="mood-l">
            {t.reflection.mood}
          </span>
          <div role="radiogroup" aria-labelledby="mood-l" className="mt-2 flex gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={f.mood === m}
                aria-label={`${m}/5`}
                onClick={() => set("mood", f.mood === m ? null : m)}
                className={cn(
                  "tabular grid size-11 cursor-pointer place-items-center rounded-full text-base font-semibold transition-colors",
                  f.mood === m ? "bg-ink text-bg" : f.mood !== null && m < f.mood ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-2 hover:bg-surface-3",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Area label={t.reflection.wins} value={f.wins} onChange={(v) => set("wins", v)} placeholder={t.reflection.winsPh} />
          <Area label={t.reflection.lessons} value={f.lessons} onChange={(v) => set("lessons", v)} placeholder={t.reflection.lessonsPh} />
        </div>

        <fieldset className="rounded-[1.25rem] bg-surface-2 p-4 sm:p-5">
          <legend className="sr-only">{t.reflection.procrastination}</legend>
          <p className="label mb-3">{t.reflection.procrastination}</p>
          <div className="flex flex-wrap gap-2">
            {CAUSES.map((c) => {
              const on = f.procrastination.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCause(c)}
                  className={cn(
                    "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
                    on ? "bg-ink text-bg" : "bg-surface text-ink-2 hover:text-ink",
                  )}
                >
                  {on && <Check className="size-4" aria-hidden />}
                  {t.reflection.causes[c]}
                </button>
              );
            })}
          </div>
          {f.procrastination.length > 0 && (
            <div className="mt-4 grid gap-3">
              <ul className="space-y-2">
                {f.procrastination.map((c) => (
                  <li key={c} className="rounded-xl bg-surface p-3 text-sm text-ink-2">
                    <span className="font-medium text-ink">{t.reflection.causes[c]}:</span> {t.reflection.tips[c]}
                  </li>
                ))}
              </ul>
              <Area label={t.reflection.procrastinationNote} value={f.procrastinationNote} onChange={(v) => set("procrastinationNote", v)} rows={2} />
            </div>
          )}
        </fieldset>

        <div className="grid gap-5 md:grid-cols-2">
          <Area label={t.reflection.gratitude} value={f.gratitude} onChange={(v) => set("gratitude", v)} placeholder={t.reflection.gratitudePh} rows={2} />
          <Area label={t.reflection.tomorrow} value={f.tomorrow} onChange={(v) => set("tomorrow", v)} placeholder={t.reflection.tomorrowPh} rows={2} />
        </div>
        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={pending}>
            {t.reflection.save}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function WeeklyForm({ weekStart, initial }: { weekStart: string; initial: WeeklyInput }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [f, setF] = useState({
    rating: initial.rating ?? null,
    highlights: initial.highlights ?? "",
    obstacles: initial.obstacles ?? "",
    rootCause: initial.rootCause ?? "",
    experiment: initial.experiment ?? "",
    nextFocus: initial.nextFocus ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => saveWeeklyReview(weekStart, f), { success: t.common.saved });
      }}
    >
      <div>
        <span className="label" id="rating-l">
          {t.reflection.rating}
        </span>
        <div role="radiogroup" aria-labelledby="rating-l" className="mt-2 flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={f.rating === r}
              onClick={() => set("rating", f.rating === r ? null : r)}
              className={cn(
                "tabular grid size-10 cursor-pointer place-items-center rounded-full text-sm font-semibold transition-colors",
                f.rating === r ? "bg-ink text-bg" : f.rating !== null && r < f.rating ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-2 hover:bg-surface-3",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <Area label={t.reflection.highlights} value={f.highlights} onChange={(v) => set("highlights", v)} placeholder={t.reflection.highlightsPh} />
      <div className="grid gap-5 md:grid-cols-2">
        <Area label={t.reflection.obstacles} value={f.obstacles} onChange={(v) => set("obstacles", v)} placeholder={t.reflection.obstaclesPh} />
        <Area label={t.reflection.rootCause} value={f.rootCause} onChange={(v) => set("rootCause", v)} placeholder={t.reflection.rootCausePh} />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Area label={t.reflection.experiment} value={f.experiment} onChange={(v) => set("experiment", v)} placeholder={t.reflection.experimentPh} />
        <Area label={t.reflection.nextFocus} value={f.nextFocus} onChange={(v) => set("nextFocus", v)} placeholder={t.reflection.nextFocusPh} />
      </div>
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={pending}>
          {t.reflection.saveWeek}
        </button>
      </div>
    </form>
  );
}
