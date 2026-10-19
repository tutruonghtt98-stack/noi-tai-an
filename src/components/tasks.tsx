"use client";
import { useOptimistic, useState, useRef, startTransition } from "react";
import { Check, Star, Clock, Plus, Trash2, ArrowRight, Target, CalendarArrowDown } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { createTask, deleteTask, moveTask, setPriority, toggleTask, updateTask } from "@/actions/tasks";
import { cn } from "@/lib/cn";
import { addDays, type ISODate } from "@/lib/dates";
import type { TaskView, GoalOption } from "@/lib/queries";
import { inkVar, softVar } from "@/lib/colors";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

type Patch = { id: string } & Partial<TaskView> & { _delete?: boolean };

export function TaskBoard({ date, tasks, goals }: { date: ISODate; tasks: TaskView[]; goals: GoalOption[] }) {
  const { t } = useI18n();
  const [list, apply] = useOptimistic(tasks, (state, p: Patch) =>
    p._delete ? state.filter((x) => x.id !== p.id) : state.map((x) => (x.id === p.id ? { ...x, ...p } : x)),
  );
  const priorities = list.filter((x) => x.priority).sort((a, b) => a.priority! - b.priority!);
  const others = list.filter((x) => !x.priority && !x.done);
  const done = list.filter((x) => !x.priority && x.done);

  return (
    <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-2">
      <section className="card hero-glow" aria-labelledby="top3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="top3" className="card-title">
            {t.today.top3}
          </h2>
          <span className="tabular text-sm text-muted">{priorities.filter((p) => p.done).length}/3</span>
        </div>
        <p className="mt-1 text-sm text-ink-2">{t.today.top3Hint}</p>
        <ol className="mt-5 space-y-2.5">
          {[0, 1, 2].map((i) => {
            const task = priorities[i];
            return task ? (
              <TaskRow key={task.id} task={task} date={date} goals={goals} apply={apply} rank={i + 1} />
            ) : (
              <li
                key={`empty-${i}`}
                className="flex min-h-16 items-center gap-4 rounded-2xl border border-dashed border-line px-4 text-sm text-muted"
              >
                <span className="grid size-8 place-items-center rounded-full bg-surface-2 font-semibold text-ink-2">{i + 1}</span>
                {t.today.makePriority}…
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card" aria-labelledby="tasks">
        <h2 id="tasks" className="card-title">
          {t.today.tasks}
        </h2>
        <AddTask date={date} goals={goals} />
        {others.length === 0 && done.length === 0 && priorities.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted">{t.today.noTasks}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {others.map((task) => (
              <TaskRow key={task.id} task={task} date={date} goals={goals} apply={apply} />
            ))}
          </ul>
        )}
        {done.length > 0 && (
          <details className="group mt-5">
            <summary className="cursor-pointer list-none text-sm font-medium text-muted hover:text-ink">
              {t.today.completed} · {done.length}
            </summary>
            <ul className="mt-2 space-y-2">
              {done.map((task) => (
                <TaskRow key={task.id} task={task} date={date} goals={goals} apply={apply} />
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

function AddTask({
  date,
  goalId,
  projectId,
  placeholder,
  goals,
}: {
  date: ISODate | null;
  goalId?: string;
  projectId?: string;
  placeholder?: string;
  goals?: GoalOption[]; // có goals → nút + mở pop-up điền đầy đủ thông tin
}) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [modal, setModal] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    exec(() => createTask({ title, date, goalId, projectId }), {
      onSuccess: () => {
        setValue("");
        ref.current?.focus();
      },
    });
  };
  return (
    <>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor={`add-${projectId ?? goalId ?? date}`}>
          {placeholder ?? t.today.addTask}
        </label>
        <input
          id={`add-${projectId ?? goalId ?? date}`}
          ref={ref}
          className="input"
          placeholder={placeholder ?? t.today.addTask}
          value={value}
          maxLength={200}
          onChange={(e) => setValue(e.target.value)}
        />
        {goals ? (
          <button type="button" className="icon-btn bg-ink text-bg hover:bg-ink hover:text-bg" onClick={() => setModal(true)} aria-label={t.taskModal.title} title={t.taskModal.title}>
            <Plus className="size-5" aria-hidden />
          </button>
        ) : (
          <button className="icon-btn bg-ink text-bg hover:bg-ink hover:text-bg" disabled={pending || !value.trim()} aria-label={t.common.add}>
            <Plus className="size-5" aria-hidden />
          </button>
        )}
      </form>
      {goals && (
        <TaskModal
          key={modal ? "open" : "closed"}
          open={modal}
          onClose={() => setModal(false)}
          date={date ?? new Date().toISOString().slice(0, 10)}
          initialTitle={value}
          goals={goals}
          onCreated={() => {
            setValue("");
            setModal(false);
          }}
        />
      )}
    </>
  );
}

/** Pop-up thêm nhiệm vụ với đầy đủ thông tin trong ngày. */
function TaskModal({
  open,
  onClose,
  date,
  initialTitle,
  goals,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  date: ISODate;
  initialTitle: string;
  goals: GoalOption[];
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [f, setF] = useState({ title: initialTitle, date, startTime: "", estimateMin: "", goalId: "", notes: "", priority: false });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} title={t.taskModal.title}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.title.trim()) return;
          exec(
            () =>
              createTask({
                title: f.title,
                date: f.date,
                startTime: f.startTime || null,
                estimateMin: f.estimateMin ? Number(f.estimateMin) : null,
                goalId: f.goalId || null,
                notes: f.notes || null,
                priority: f.priority,
              }),
            {
              success: t.taskModal.added,
              onSuccess: (r) => {
                if (r.priorityFull) toast("error", t.today.priorityFull);
                if (f.startTime) window.dispatchEvent(new Event("nta:schedule-changed"));
                onCreated();
              },
            },
          );
        }}
      >
        <label className="field">
          <span className="label">{t.taskModal.name}</span>
          <input className="input" required maxLength={200} autoFocus value={f.title} placeholder={t.taskModal.namePh} onChange={(e) => set("title", e.target.value)} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="field">
            <span className="label">{t.taskModal.date}</span>
            <input type="date" className="input" required value={f.date} onChange={(e) => set("date", e.target.value)} />
          </label>
          <label className="field">
            <span className="label">{t.today.startTime}</span>
            <input type="time" className="input" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} />
          </label>
          <label className="field">
            <span className="label">{t.today.estimate}</span>
            <input type="number" inputMode="numeric" min={1} max={720} className="input" value={f.estimateMin} onChange={(e) => set("estimateMin", e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="label">{t.today.linkGoal}</span>
          <select className="input" value={f.goalId} onChange={(e) => set("goalId", e.target.value)}>
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
            {t.taskModal.notes} <span className="font-normal text-muted">({t.common.optional})</span>
          </span>
          <textarea className="input" maxLength={2000} value={f.notes} placeholder={t.taskModal.notesPh} onChange={(e) => set("notes", e.target.value)} />
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-2 p-3 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={f.priority} onChange={(e) => set("priority", e.target.checked)} />
          <Star className={cn("size-4", f.priority && "fill-ochre stroke-ochre-ink")} aria-hidden /> {t.taskModal.makeTop3}
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button className="btn btn-primary" disabled={pending || !f.title.trim()}>
            {t.common.add}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export { AddTask };

function TaskRow({
  task,
  date,
  goals,
  apply,
  rank,
}: {
  task: TaskView;
  date: ISODate;
  goals: GoalOption[];
  apply: (p: Patch) => void;
  rank?: number;
}) {
  const { t } = useI18n();
  const { exec } = useAction();
  const [open, setOpen] = useState(false);

  const optimistic = (p: Patch, fn: () => ReturnType<typeof toggleTask>) =>
    startTransition(async () => {
      apply(p);
      exec(fn);
    });

  return (
    <li
      className={cn(
        "rounded-2xl bg-surface-2 transition-colors",
        task.done && "opacity-60",
        rank && "bg-surface/80 shadow-card ring-1 ring-line",
      )}
    >
      <div className="flex min-h-16 items-center gap-3 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          role="checkbox"
          aria-checked={task.done}
          aria-label={task.title}
          className="check"
          onClick={() => optimistic({ id: task.id, done: !task.done }, () => toggleTask(task.id))}
        >
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </button>
        <button type="button" className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className={cn("block truncate font-medium", task.done && "line-through decoration-muted")}>{task.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {task.startTime && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden /> {task.startTime}
              </span>
            )}
            {task.estimateMin && <span>{task.estimateMin}′</span>}
            {task.goal && (
              <span
                className="inline-flex max-w-40 items-center gap-1 truncate rounded-full px-2 py-0.5"
                style={{ background: softVar(task.goal.color), color: inkVar(task.goal.color) }}
              >
                <Target className="size-3" aria-hidden /> <span className="truncate">{task.goal.title}</span>
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          className={cn("icon-btn icon-btn-plain", task.priority && "text-ochre-ink")}
          aria-pressed={!!task.priority}
          aria-label={task.priority ? t.today.removePriority : t.today.makePriority}
          title={task.priority ? t.today.removePriority : t.today.makePriority}
          onClick={() => exec(() => setPriority(task.id, !task.priority))}
        >
          <Star className={cn("size-5", task.priority && "fill-ochre stroke-ochre-ink")} aria-hidden />
        </button>
      </div>
      {open && <TaskEditor task={task} date={date} goals={goals} apply={apply} onDone={() => setOpen(false)} />}
    </li>
  );
}

function TaskEditor({
  task,
  date,
  goals,
  apply,
  onDone,
}: {
  task: TaskView;
  date: ISODate;
  goals: GoalOption[];
  apply: (p: Patch) => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [startTime, setStart] = useState(task.startTime ?? "");
  const [estimate, setEstimate] = useState(task.estimateMin?.toString() ?? "");
  const [goalId, setGoal] = useState(task.goal?.id ?? "");
  const [title, setTitle] = useState(task.title);

  const save = () =>
    exec(
      () =>
        updateTask(task.id, {
          title,
          startTime: startTime || null,
          estimateMin: estimate ? Number(estimate) : null,
          goalId: goalId || null,
        }),
      {
        onSuccess: () => {
          window.dispatchEvent(new Event("nta:schedule-changed"));
          onDone();
        },
        success: t.common.saved,
      },
    );

  return (
    <div className="grid gap-3 border-t border-line px-4 pb-4 pt-3 sm:grid-cols-2">
      <label className="field sm:col-span-2">
        <span className="label">{t.goals.fields.title}</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </label>
      <label className="field">
        <span className="label">{t.today.startTime}</span>
        <input type="time" className="input" value={startTime} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label className="field">
        <span className="label">{t.today.estimate}</span>
        <input type="number" inputMode="numeric" min={1} max={720} className="input" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
      </label>
      <label className="field sm:col-span-2">
        <span className="label">{t.today.linkGoal}</span>
        <select className="input" value={goalId} onChange={(e) => setGoal(e.target.value)}>
          <option value="">{t.common.none}</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {t.goals.horizon[g.horizon]} · {g.title}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={pending || !title.trim()}>
          {t.common.save}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            startTransition(async () => {
              apply({ id: task.id, _delete: true });
              exec(() => moveTask(task.id, addDays(date, 1)));
            })
          }
        >
          <CalendarArrowDown className="size-4" aria-hidden /> {t.today.moveTomorrow}
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm ml-auto"
          onClick={() => {
            if (!confirm(t.common.confirmDelete)) return;
            startTransition(async () => {
              apply({ id: task.id, _delete: true });
              exec(() => deleteTask(task.id));
            });
          }}
        >
          <Trash2 className="size-4" aria-hidden /> {t.common.delete}
        </button>
      </div>
    </div>
  );
}

/** Danh sách gợi ý kéo vào hôm nay (việc quá hạn + chưa lên lịch). */
export function PullList({ items, date }: { items: { id: string; title: string; meta?: string }[]; date: ISODate }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id} className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface-2 py-1.5 pl-4 pr-1.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{i.title}</span>
            {i.meta && <span className="block truncate text-xs text-muted">{i.meta}</span>}
          </span>
          <button
            type="button"
            className="btn btn-soft btn-sm bg-surface"
            disabled={pending}
            onClick={() => exec(() => moveTask(i.id, date))}
            aria-label={`${t.today.pullToday}: ${i.title}`}
          >
            {t.today.pullToday} <ArrowRight className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Dòng hành động gọn (dùng trong trang chi tiết mục tiêu). */
export function ActionItem({ id, title, done, date, today }: { id: string; title: string; done: boolean; date: string | null; today: ISODate }) {
  const { t } = useI18n();
  const { exec } = useAction();
  const [isDone, setDone] = useOptimistic(done);
  return (
    <li className="group flex min-h-12 items-center gap-3 rounded-2xl px-2 hover:bg-surface-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        aria-label={title}
        className="check"
        onClick={() =>
          startTransition(async () => {
            setDone(!isDone);
            exec(() => toggleTask(id));
          })
        }
      >
        <Check className="size-4" strokeWidth={3} aria-hidden />
      </button>
      <span className={cn("min-w-0 flex-1 truncate", isDone && "text-muted line-through")}>{title}</span>
      {date ? (
        <span className="badge">{date}</span>
      ) : (
        !isDone && (
          <TodayButton id={id} today={today} label={t.goals.scheduleToday} />
        )
      )}
      <button
        type="button"
        className="icon-btn icon-btn-plain size-9 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        aria-label={`${t.common.delete}: ${title}`}
        onClick={() => confirm(t.common.confirmDelete) && exec(() => deleteTask(id))}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}

function TodayButton({ id, today, label }: { id: string; today: ISODate; label: string }) {
  const { exec, pending } = useAction();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={pending}
      onClick={() => exec(() => moveTask(id, today))}
    >
      {label}
    </button>
  );
}
