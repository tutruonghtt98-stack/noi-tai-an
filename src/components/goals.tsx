"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, RotateCcw, Pause, ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { useAction } from "@/lib/use-action";
import { createGoal, deleteGoal, setGoalStatus, setGoalValue, updateGoal, type GoalInput } from "@/actions/goals";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-ring";
import { ColorPicker } from "@/components/habits";
import { colorVar, inkVar, softVar } from "@/lib/colors";
import type { GoalOption, GoalView } from "@/lib/queries";
import { periodLabel } from "@/lib/goal-format";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";

type Horizon = "YEAR" | "QUARTER" | "MONTH";

export function GoalCard({ goal }: { goal: GoalView }) {
  const { t } = useI18n();
  const pct = Math.round(goal.progress * 100);
  return (
    <Link
      href={`/goals/${goal.id}`}
      className={cn(
        "card rise group flex flex-col gap-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-pop",
        goal.status !== "ACTIVE" && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge" style={{ background: softVar(goal.color), color: inkVar(goal.color) }}>
            {t.goals.horizon[goal.horizon]} · {periodLabel(goal, t)}
          </span>
          {goal.status !== "ACTIVE" && <span className="badge">{t.goals.status[goal.status]}</span>}
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 transition-colors group-hover:bg-ink group-hover:text-bg">
          <ArrowUpRight className="size-4" aria-hidden />
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold leading-snug">{goal.title}</h3>
        {goal.why && <p className="mt-1 line-clamp-2 text-sm text-ink-2">{goal.why}</p>}
      </div>
      <div className="mt-auto">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="text-muted">
            {goal.targetValue
              ? `${goal.currentValue}/${goal.targetValue} ${goal.unit ?? ""}`
              : goal.counts.tasks
                ? fmt(t.goals.tasksDone, { d: goal.counts.done, t: goal.counts.tasks })
                : goal.parent?.title ?? t.goals.progress}
          </span>
          <span className="tabular font-semibold">{pct}%</span>
        </div>
        <ProgressBar value={goal.progress} color={colorVar(goal.color)} label={goal.title} />
      </div>
    </Link>
  );
}

// ---------- Form ----------

export function NewGoalButton({
  options,
  defaults,
  label,
  variant = "primary",
}: {
  options: GoalOption[];
  defaults?: Partial<GoalInput>;
  label?: string;
  variant?: "primary" | "soft";
}) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [k, setK] = useState(0);
  return (
    <>
      <button type="button" className={cn("btn", variant === "primary" ? "btn-primary" : "btn-soft")} onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {label ?? t.goals.new}
      </button>
      <GoalForm
        key={k}
        open={open}
        onClose={() => setOpen(false)}
        options={options}
        initial={defaults}
        pending={pending}
        onSubmit={(data) =>
          exec(() => createGoal(data), {
            success: t.common.saved,
            onSuccess: () => {
              setOpen(false);
              setK((x) => x + 1);
            },
          })
        }
      />
    </>
  );
}

export function GoalForm({
  open,
  onClose,
  options,
  initial,
  onSubmit,
  pending,
  selfId,
}: {
  open: boolean;
  onClose: () => void;
  options: GoalOption[];
  initial?: Partial<GoalInput>;
  onSubmit: (d: GoalInput) => void;
  pending?: boolean;
  selfId?: string;
}) {
  const { t } = useI18n();
  const now = new Date();
  const [f, setF] = useState({
    title: initial?.title ?? "",
    why: (initial?.why as string) ?? "",
    horizon: (initial?.horizon as Horizon) ?? "YEAR",
    year: Number(initial?.year ?? now.getFullYear()),
    quarter: Number(initial?.quarter ?? Math.floor(now.getMonth() / 3) + 1),
    month: Number(initial?.month ?? now.getMonth() + 1),
    parentId: (initial?.parentId as string) ?? "",
    targetValue: initial?.targetValue != null ? String(initial.targetValue) : "",
    unit: (initial?.unit as string) ?? "",
    dueDate: (initial?.dueDate as string) ?? "",
    color: (initial?.color as string) ?? "ochre",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const rank: Record<Horizon, number> = { YEAR: 0, QUARTER: 1, MONTH: 2 };
  const parents = options.filter((o) => o.id !== selfId && rank[o.horizon] < rank[f.horizon]);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2];

  return (
    <Modal open={open} onClose={onClose} title={selfId ? t.common.edit : t.goals.new}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            ...f,
            parentId: f.parentId || null,
            targetValue: f.targetValue === "" ? null : Number(f.targetValue),
            dueDate: f.dueDate || null,
            color: f.color as "ochre",
          });
        }}
      >
        <label className="field">
          <span className="label">{t.goals.fields.title}</span>
          <input className="input" required maxLength={160} autoFocus value={f.title} placeholder={t.goals.fields.titlePh} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="field">
          <span className="label">{t.goals.fields.why}</span>
          <textarea className="input" maxLength={600} value={f.why} placeholder={t.goals.fields.whyPh} onChange={(e) => set("why", e.target.value)} />
        </label>

        <fieldset className="field">
          <legend className="label mb-1.5">{t.goals.fields.horizon}</legend>
          <div className="segmented w-fit">
            {(["YEAR", "QUARTER", "MONTH"] as const).map((h) => (
              <button key={h} type="button" aria-pressed={f.horizon === h} onClick={() => set("horizon", h)}>
                {t.goals.horizon[h]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <label className="field">
            <span className="label">{t.goals.fields.year}</span>
            <select className="input" value={f.year} onChange={(e) => set("year", Number(e.target.value))}>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          {f.horizon === "QUARTER" && (
            <label className="field">
              <span className="label">{t.goals.fields.quarter}</span>
              <select className="input" value={f.quarter} onChange={(e) => set("quarter", Number(e.target.value))}>
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    Q{q}
                  </option>
                ))}
              </select>
            </label>
          )}
          {f.horizon === "MONTH" && (
            <label className="field">
              <span className="label">{t.goals.fields.month}</span>
              <select className="input" value={f.month} onChange={(e) => set("month", Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {parents.length > 0 && (
          <label className="field">
            <span className="label">
              {t.goals.fields.parent} <span className="font-normal text-muted">({t.common.optional})</span>
            </span>
            <select className="input" value={f.parentId} onChange={(e) => set("parentId", e.target.value)}>
              <option value="">{t.common.none}</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {t.goals.horizon[p.horizon]} · {p.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="field">
            <span className="label">
              {t.goals.fields.target} <span className="font-normal text-muted">({t.common.optional})</span>
            </span>
            <input type="number" inputMode="decimal" min={0} step="any" className="input" value={f.targetValue} onChange={(e) => set("targetValue", e.target.value)} />
          </label>
          <label className="field">
            <span className="label">{t.goals.fields.unit}</span>
            <input className="input" maxLength={24} value={f.unit} placeholder={t.goals.fields.unitPh} onChange={(e) => set("unit", e.target.value)} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span className="label">
              {t.goals.fields.due} <span className="font-normal text-muted">({t.common.optional})</span>
            </span>
            <input type="date" className="input" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </label>
          <ColorPicker value={f.color} onChange={(c) => set("color", c)} label={t.goals.fields.color} />
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button className="btn btn-primary" disabled={pending || !f.title.trim()}>
            {selfId ? t.common.save : t.common.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Detail controls ----------

export function GoalControls({
  goal,
  options,
}: {
  goal: GoalView & { description?: string | null };
  options: GoalOption[];
}) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const router = useRouter();
  const [edit, setEdit] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      {goal.status === "COMPLETED" || goal.status === "PAUSED" ? (
        <button type="button" className="btn btn-soft" disabled={pending} onClick={() => exec(() => setGoalStatus(goal.id, "ACTIVE"))}>
          <RotateCcw className="size-4" aria-hidden /> {t.goals.reopen}
        </button>
      ) : (
        <>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => exec(() => setGoalStatus(goal.id, "COMPLETED"), { success: t.goals.status.COMPLETED })}>
            <CheckCircle2 className="size-4" aria-hidden /> {t.goals.markComplete}
          </button>
          <button type="button" className="icon-btn" disabled={pending} onClick={() => exec(() => setGoalStatus(goal.id, "PAUSED"))} aria-label={t.goals.pause} title={t.goals.pause}>
            <Pause className="size-4" aria-hidden />
          </button>
        </>
      )}
      <button type="button" className="icon-btn" onClick={() => setEdit(true)} aria-label={t.common.edit} title={t.common.edit}>
        <Pencil className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className="icon-btn hover:text-danger"
        aria-label={t.common.delete}
        title={t.common.delete}
        onClick={() => confirm(t.common.confirmDelete) && exec(() => deleteGoal(goal.id), { onSuccess: () => router.push("/goals") })}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
      <GoalForm
        open={edit}
        onClose={() => setEdit(false)}
        options={options}
        selfId={goal.id}
        pending={pending}
        initial={{
          title: goal.title,
          why: goal.why ?? "",
          horizon: goal.horizon,
          year: goal.year,
          quarter: goal.quarter,
          month: goal.month,
          parentId: goal.parent?.id ?? "",
          targetValue: goal.targetValue,
          unit: goal.unit ?? "",
          dueDate: goal.dueDate ?? "",
          color: goal.color as "ochre",
        }}
        onSubmit={(d) => exec(() => updateGoal(goal.id, d), { success: t.common.saved, onSuccess: () => setEdit(false) })}
      />
    </div>
  );
}

export function GoalValue({ id, current, target, unit, color }: { id: string; current: number; target: number; unit: string | null; color: string }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [v, setV] = useState(String(current));
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => setGoalValue(id, Number(v) || 0), { success: t.common.saved });
      }}
    >
      <label className="field w-36">
        <span className="label">{t.goals.updateValue}</span>
        <input type="number" inputMode="decimal" step="any" min={0} className="input" value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <span className="pb-3 text-sm text-muted">
        / {target} {unit}
      </span>
      <button className="btn btn-soft" disabled={pending} style={{ background: softVar(color), color: inkVar(color) }}>
        {t.common.save}
      </button>
    </form>
  );
}
