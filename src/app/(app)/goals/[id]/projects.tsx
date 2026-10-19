"use client";
import { useState } from "react";
import { FolderPlus, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { createProject, deleteProject, setProjectStatus } from "@/actions/goals";
import { ActionItem, AddTask } from "@/components/tasks";
import { ProgressBar } from "@/components/ui/progress-ring";
import { cn } from "@/lib/cn";

type Task = { id: string; title: string; done: boolean; date: string | null };

export function ProjectCard({
  project,
  tasks,
  today,
}: {
  project: { id: string; title: string; status: string; goalId: string };
  tasks: Task[];
  today: string;
}) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const done = tasks.filter((x) => x.done).length;
  const finished = project.status === "DONE";

  return (
    <article className={cn("card", finished && "opacity-75")}>
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-lg font-semibold", finished && "line-through decoration-muted")}>{project.title}</h3>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar value={tasks.length ? done / tasks.length : finished ? 1 : 0} label={project.title} />
            </div>
            <span className="tabular text-sm text-muted">
              {done}/{tasks.length}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn icon-btn-plain"
          disabled={pending}
          aria-label={finished ? t.goals.reopen : t.goals.markComplete}
          title={finished ? t.goals.reopen : t.goals.markComplete}
          onClick={() => exec(() => setProjectStatus(project.id, finished ? "ACTIVE" : "DONE"))}
        >
          {finished ? <RotateCcw className="size-4" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-plain hover:text-danger"
          aria-label={`${t.common.delete}: ${project.title}`}
          onClick={() => confirm(t.common.confirmDelete) && exec(() => deleteProject(project.id))}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </header>
      <ul className="mt-3 space-y-0.5">
        {tasks.map((task) => (
          <ActionItem key={task.id} {...task} today={today} />
        ))}
      </ul>
      {!finished && <AddTask date={null} goalId={project.goalId} projectId={project.id} placeholder={t.goals.newAction} />}
    </article>
  );
}

export function NewProject({ goalId }: { goalId: string }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [title, setTitle] = useState("");
  return (
    <form
      className="flex gap-2 rounded-[1.75rem] border border-dashed border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        exec(() => createProject(goalId, title), { onSuccess: () => setTitle("") });
      }}
    >
      <label htmlFor="new-project" className="sr-only">
        {t.goals.newProject}
      </label>
      <input id="new-project" className="input bg-transparent" placeholder={t.goals.projectPh} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
      <button className="btn btn-soft shrink-0" disabled={pending || !title.trim()}>
        <FolderPlus className="size-4" aria-hidden /> {t.goals.newProject}
      </button>
    </form>
  );
}
