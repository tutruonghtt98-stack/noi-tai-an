"use client";
import { startTransition, useOptimistic, useState } from "react";
import {
  BookOpen,
  Dumbbell,
  Brain,
  Droplets,
  Moon,
  Sun,
  PenLine,
  Footprints,
  Apple,
  Code,
  Music,
  Leaf,
  Heart,
  CircleCheck,
  Flame,
  Plus,
  Pencil,
  Archive,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { archiveHabit, createHabit, deleteHabit, toggleHabit, updateHabit, type HabitInput } from "@/actions/habits";
import { Modal } from "@/components/ui/modal";
import { COLORS, colorVar, inkVar, softVar } from "@/lib/colors";
import { addDays, dayOfWeek, monthBounds, rangeISO, type ISODate } from "@/lib/dates";
import { isScheduled } from "@/lib/stats";
import type { HabitView, GoalOption } from "@/lib/queries";
import { cn } from "@/lib/cn";

export const HABIT_ICONS: Record<string, LucideIcon> = {
  "circle-check": CircleCheck,
  book: BookOpen,
  dumbbell: Dumbbell,
  brain: Brain,
  water: Droplets,
  moon: Moon,
  sun: Sun,
  pen: PenLine,
  walk: Footprints,
  apple: Apple,
  code: Code,
  music: Music,
  leaf: Leaf,
  heart: Heart,
};
export const HabitIcon = ({ name, className }: { name: string; className?: string }) => {
  const I = HABIT_ICONS[name] ?? CircleCheck;
  return <I className={className} aria-hidden />;
};

/** Nút check-in tròn, hỗ trợ thói quen nhiều lần/ngày. */
function useHabitToggle(habit: Pick<HabitView, "id" | "targetPerDay">, date: ISODate, count: number) {
  const { exec } = useAction();
  const [optimistic, set] = useOptimistic(count);
  const toggle = () =>
    startTransition(async () => {
      set(optimistic + 1 > habit.targetPerDay ? 0 : optimistic + 1);
      exec(() => toggleHabit(habit.id, date));
    });
  return { count: optimistic, toggle };
}

/** Danh sách check-in nhanh (Dashboard, Thực thi). */
export function HabitQuickList({ habits, today }: { habits: HabitView[]; today: ISODate }) {
  const { t } = useI18n();
  if (!habits.length) return <p className="py-4 text-sm text-muted">{t.dashboard.habitsEmpty}</p>;
  return (
    <ul className="space-y-2">
      {habits.map((h) => (
        <QuickRow key={h.id} habit={h} today={today} />
      ))}
    </ul>
  );
}

function QuickRow({ habit, today }: { habit: HabitView; today: ISODate }) {
  const { t } = useI18n();
  const { count, toggle } = useHabitToggle(habit, today, habit.todayCount);
  const done = count >= habit.targetPerDay;
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={toggle}
        className={cn(
          "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 text-left transition-colors",
          done ? "bg-[var(--c-soft)]" : "bg-surface-2 hover:bg-surface-3",
        )}
        style={{ ["--c-soft" as string]: softVar(habit.color) }}
      >
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full"
          style={{ background: done ? colorVar(habit.color) : "var(--surface)", color: done ? "#1d1c1a" : inkVar(habit.color) }}
        >
          {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <HabitIcon name={habit.icon} className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-medium", done && "text-ink-2")}>{habit.name}</span>
          {habit.targetPerDay > 1 && (
            <span className="tabular text-xs text-muted">
              {count}/{habit.targetPerDay}
            </span>
          )}
        </span>
        {habit.stats.current > 0 && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-ink-2" title={t.habits.streak}>
            <Flame className="size-4 text-rose" aria-hidden />
            <span className="tabular">{habit.stats.current}</span>
          </span>
        )}
      </button>
    </li>
  );
}

/** Thẻ thói quen đầy đủ (trang Habits). */
export function HabitCard({ habit, today, goals, weekStartsOn }: { habit: HabitView; today: ISODate; goals: GoalOption[]; weekStartsOn: number }) {
  const { t } = useI18n();
  const { exec } = useAction();
  const [edit, setEdit] = useState(false);
  const [showMonth, setShowMonth] = useState(false);
  const week = rangeISO(addDays(today, -6), today);

  return (
    <article className="card rise flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-2xl"
          style={{ background: softVar(habit.color), color: inkVar(habit.color) }}
        >
          <HabitIcon name={habit.icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{habit.name}</h3>
          <p className="truncate text-sm text-muted">
            {habit.daysOfWeek.length === 0
              ? t.habits.fields.everyday
              : habit.daysOfWeek.map((d) => t.habits.weekdays[d]).join(" · ")}
            {habit.targetPerDay > 1 && ` · ${habit.targetPerDay}×`}
            {habit.goal && ` · ${habit.goal.title}`}
          </p>
        </div>
        <button type="button" className="icon-btn icon-btn-plain -mr-2" onClick={() => setEdit(true)} aria-label={`${t.common.edit}: ${habit.name}`}>
          <Pencil className="size-4" aria-hidden />
        </button>
      </header>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label={t.habits.streak} value={habit.stats.current} icon={<Flame className="size-4 text-rose" aria-hidden />} />
        <Stat label={t.habits.best} value={habit.stats.best} />
        <Stat label={t.habits.rate30} value={`${Math.round(habit.stats.rate * 100)}%`} />
      </dl>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-ink-2">{t.habits.week}</span>
          <button type="button" className="text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => setShowMonth((v) => !v)} aria-expanded={showMonth}>
            {t.habits.month}
          </button>
        </div>
        <ul className="grid grid-cols-7 gap-1.5">
          {week.map((d) => (
            <DayDot key={d} habit={habit} date={d} today={today} />
          ))}
        </ul>
      </div>

      {showMonth && <HabitMonth habit={habit} today={today} weekStartsOn={weekStartsOn} />}

      <HabitForm
        open={edit}
        onClose={() => setEdit(false)}
        goals={goals}
        habit={habit}
        onSubmit={(data) => exec(() => updateHabit(habit.id, data), { onSuccess: () => setEdit(false), success: t.common.saved })}
        extra={
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => exec(() => archiveHabit(habit.id), { onSuccess: () => setEdit(false) })}>
              <Archive className="size-4" aria-hidden /> {t.habits.archive}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => confirm(t.common.confirmDelete) && exec(() => deleteHabit(habit.id), { onSuccess: () => setEdit(false) })}
            >
              <Trash2 className="size-4" aria-hidden /> {t.common.delete}
            </button>
          </div>
        }
      />
    </article>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-3">
      <dd className="tabular flex items-center justify-center gap-1 text-xl font-semibold">
        {icon}
        {value}
      </dd>
      <dt className="mt-0.5 text-xs text-muted">{label}</dt>
    </div>
  );
}

function DayDot({ habit, date, today }: { habit: HabitView; date: ISODate; today: ISODate }) {
  const { t, locale } = useI18n();
  const { count, toggle } = useHabitToggle(habit, date, habit.logs[date] ?? 0);
  const done = count >= habit.targetPerDay;
  const scheduled = isScheduled(habit, date);
  const partial = count > 0 && !done;
  const label = `${t.habits.weekdaysLong[dayOfWeek(date)]} ${date.slice(8)}/${date.slice(5, 7)}`;
  return (
    <li className="flex flex-col items-center gap-1">
      <span className="text-[0.6875rem] font-medium text-muted">{t.habits.weekdays[dayOfWeek(date)]}</span>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${habit.name} — ${label}${scheduled ? "" : ` (${t.habits.notToday})`}`}
        lang={locale}
        onClick={toggle}
        className={cn(
          "tabular grid aspect-square w-full max-w-11 cursor-pointer place-items-center rounded-full text-sm font-medium transition-[background-color,transform] active:scale-90",
          !done && !partial && (scheduled ? "bg-surface-2 text-ink-2 hover:bg-surface-3" : "border border-dashed border-line text-muted"),
          date === today && !done && "ring-2 ring-ink/70 ring-offset-2 ring-offset-surface",
        )}
        style={
          done
            ? { background: colorVar(habit.color), color: "#1d1c1a" }
            : partial
              ? { background: softVar(habit.color), color: inkVar(habit.color) }
              : undefined
        }
      >
        {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : Number(date.slice(8))}
      </button>
    </li>
  );
}

function HabitMonth({ habit, today, weekStartsOn }: { habit: HabitView; today: ISODate; weekStartsOn: number }) {
  const { t, locale } = useI18n();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const { from, to } = monthBounds(cursor.y, cursor.m);
  const days = rangeISO(from, to);
  const lead = (dayOfWeek(from) - weekStartsOn + 7) % 7;
  const order = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + weekStartsOn) % 7);
  const shift = (n: number) =>
    setCursor((c) => {
      const m = c.m + n;
      return m < 1 ? { y: c.y - 1, m: 12 } : m > 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m };
    });
  const title = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(cursor.y, cursor.m - 1, 1)),
  );

  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="icon-btn icon-btn-plain size-9" onClick={() => shift(-1)} aria-label={t.common.prev}>
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="text-sm font-semibold capitalize">{title}</span>
        <button type="button" className="icon-btn icon-btn-plain size-9" onClick={() => shift(1)} aria-label={t.common.next} disabled={to >= today}>
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.6875rem] font-medium text-muted">
        {order.map((d) => (
          <span key={d}>{t.habits.weekdays[d]}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => (
          <span key={`l${i}`} />
        ))}
        {days.map((d) => {
          const c = habit.logs[d] ?? 0;
          const done = c >= habit.targetPerDay;
          return (
            <span
              key={d}
              title={d}
              className={cn(
                "tabular grid aspect-square place-items-center rounded-full text-xs",
                d > today ? "text-muted/50" : done ? "font-semibold" : c > 0 ? "" : "text-ink-2",
                d === today && "ring-2 ring-ink/60",
              )}
              style={done ? { background: colorVar(habit.color), color: "#1d1c1a" } : c > 0 ? { background: softVar(habit.color) } : undefined}
            >
              {Number(d.slice(8))}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Form ----------

export function NewHabitButton({ goals }: { goals: GoalOption[] }) {
  const { t } = useI18n();
  const { exec } = useAction();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {t.habits.new}
      </button>
      <HabitForm
        key={formKey}
        open={open}
        onClose={() => setOpen(false)}
        goals={goals}
        onSubmit={(data) =>
          exec(() => createHabit(data), {
            onSuccess: () => {
              setOpen(false);
              setFormKey((k) => k + 1);
            },
            success: t.common.saved,
          })
        }
      />
    </>
  );
}

function HabitForm({
  open,
  onClose,
  goals,
  habit,
  onSubmit,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  goals: GoalOption[];
  habit?: HabitView;
  onSubmit: (data: HabitInput) => void;
  extra?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [days, setDays] = useState<number[]>(habit?.daysOfWeek.length ? habit.daysOfWeek : [0, 1, 2, 3, 4, 5, 6]);
  const [target, setTarget] = useState(habit?.targetPerDay ?? 1);
  const [goalId, setGoalId] = useState(habit?.goalId ?? "");
  const [color, setColor] = useState(habit?.color ?? "jade");
  const [icon, setIcon] = useState(habit?.icon ?? "circle-check");

  const toggleDay = (d: number) => setDays((a) => (a.includes(d) ? (a.length > 1 ? a.filter((x) => x !== d) : a) : [...a, d]));

  return (
    <Modal open={open} onClose={onClose} title={habit ? habit.name : t.habits.new}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name, description, daysOfWeek: days, targetPerDay: target, goalId: goalId || null, color: color as "jade", icon });
        }}
      >
        <label className="field">
          <span className="label">{t.habits.fields.name}</span>
          <input className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.habits.fields.namePh} autoFocus />
        </label>

        <fieldset className="field">
          <legend className="label mb-1.5">{t.habits.fields.icon}</legend>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(HABIT_ICONS).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={icon === k}
                aria-label={k}
                onClick={() => setIcon(k)}
                className={cn("grid size-10 cursor-pointer place-items-center rounded-xl transition-colors", icon === k ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3")}
              >
                <HabitIcon name={k} className="size-4" />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="label mb-1.5">{t.habits.fields.days}</legend>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                aria-label={t.habits.weekdaysLong[d]}
                onClick={() => toggleDay(d)}
                className={cn("h-10 min-w-11 cursor-pointer rounded-full px-3 text-sm font-medium transition-colors", days.includes(d) ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3")}
              >
                {t.habits.weekdays[d]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span className="label">{t.habits.fields.target}</span>
            <input type="number" inputMode="numeric" min={1} max={20} className="input" value={target} onChange={(e) => setTarget(Number(e.target.value) || 1)} />
          </label>
          <ColorPicker value={color} onChange={setColor} label={t.habits.fields.color} />
        </div>

        <label className="field">
          <span className="label">
            {t.habits.fields.goal} <span className="font-normal text-muted">({t.common.optional})</span>
          </span>
          <select className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">{t.common.none}</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {t.goals.horizon[g.horizon]} · {g.title}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="label">
            {t.habits.fields.description} <span className="font-normal text-muted">({t.common.optional})</span>
          </span>
          <textarea className="input" maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          {extra ?? <span />}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t.common.cancel}
            </button>
            <button className="btn btn-primary" disabled={!name.trim()}>
              {habit ? t.common.save : t.common.create}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  const { t } = useI18n();
  return (
    <fieldset className="field">
      <legend className="label mb-1.5">{label}</legend>
      <div className="flex h-11 items-center gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={value === c}
            aria-label={t.settings.accents[c]}
            title={t.settings.accents[c]}
            onClick={() => onChange(c)}
            className={cn("size-9 cursor-pointer rounded-full transition-transform hover:scale-105", value === c && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
            style={{ background: colorVar(c) }}
          />
        ))}
      </div>
    </fieldset>
  );
}
