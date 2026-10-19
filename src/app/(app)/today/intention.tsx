"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { saveDailyPlan } from "@/actions/tasks";
import { cn } from "@/lib/cn";

const ENERGY = [1, 2, 3, 4, 5] as const;

export function IntentionCard({ date, intention, energy }: { date: string; intention: string; energy: number | null }) {
  const { t } = useI18n();
  const { exec } = useAction();
  const [text, setText] = useState(intention);
  const [level, setLevel] = useState(energy);

  const persist = (next: { intention?: string; energy?: number | null }) =>
    exec(() => saveDailyPlan(date, { intention: next.intention ?? text, energy: next.energy !== undefined ? next.energy : level }));

  return (
    <section className="card hero-glow">
      <label htmlFor="intention" className="card-title block">
        {t.today.intention}
      </label>
      <textarea
        id="intention"
        rows={2}
        maxLength={400}
        className="mt-3 w-full resize-none bg-transparent text-xl font-medium leading-snug placeholder:text-muted/70 focus:outline-none sm:text-2xl"
        placeholder={t.today.intentionPh}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== intention && persist({ intention: text })}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-ink-2" id="energy-label">
          {t.today.energy}
        </span>
        <div className="flex gap-1.5" role="radiogroup" aria-labelledby="energy-label">
          {ENERGY.map((v) => {
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={level === v}
                aria-label={`${v}/5`}
                onClick={() => {
                  const next = level === v ? null : v;
                  setLevel(next);
                  persist({ energy: next });
                }}
                className={cn(
                  "flex size-11 cursor-pointer items-end justify-center gap-[3px] rounded-full pb-3 transition-[background-color,transform] active:scale-90",
                  level !== null && v <= level ? "bg-accent text-ink" : "bg-surface-2 text-muted hover:bg-surface-3",
                )}
              >
                {Array.from({ length: v }).map((_, i) => (
                  <span key={i} aria-hidden className="w-[3px] rounded-full bg-current" style={{ height: 4 + i * 3 }} />
                ))}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
