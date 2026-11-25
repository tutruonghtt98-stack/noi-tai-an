"use client";
import { useEffect, useRef, useState } from "react";
import { AlignLeft, Calendar, Check, ChevronDown, Columns3, Plus, Tag, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/modal";
import { createWorkCard } from "@/actions/work";
import { AssigneesPicker, type AssigneesPickerHandle, type MemberOption } from "./assignee-picker";
import { STATUS_ICON, STATUS_TEXT_CLASS } from "./kanban-board";
import { DEFAULT_LISTS } from "@/lib/work-types";

export function NewTaskButton({
  boards,
  teams = [],
  members = [],
}: {
  boards: { id: string; name: string; lists: { id: string; name: string }[] }[];
  teams?: { id: string; name: string }[];
  members?: MemberOption[];
}) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const assigneesRef = useRef<AssigneesPickerHandle>(null);
  const [teamId, setTeamId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState(DEFAULT_LISTS[0]!.name);
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");

  const reset = () => {
    setLabel("");
    setTitle("");
    setDescription("");
    setAssignees([]);
    setTeamId("");
    setDueDate("");
    setStatus(DEFAULT_LISTS[0]!.name);
    setBoardId(boards[0]?.id ?? "");
  };

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        {w.newTask}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.newTaskTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const listId = boards.find((b) => b.id === boardId)?.lists.find((l) => l.name === status)?.id;
            if (!listId) return;
            // Gom email đang gõ dở (chưa nhấn Enter) vào danh sách; null = sai định dạng, lỗi đã hiện ở ô nhập.
            const finalAssignees = assigneesRef.current ? assigneesRef.current.flush() : assignees;
            if (!finalAssignees) return;
            exec(
              () =>
                createWorkCard({
                  listId,
                  label: label || undefined,
                  title,
                  description: description || undefined,
                  assignees: finalAssignees,
                  teamId: teamId || undefined,
                  dueDate: dueDate || undefined,
                }),
              {
                success: w.cardAdded,
                onSuccess: () => {
                  setOpen(false);
                  reset();
                },
              },
            );
          }}
        >
          <label className="field">
            <span className="label">{w.cardTitle}</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={w.cardTitlePh} required maxLength={160} autoFocus />
          </label>
          <div className="rounded-xl border border-line p-4">
            <label className="field">
              <span className="label inline-flex items-center gap-1.5"><AlignLeft className="size-3.5" aria-hidden /> {w.cardDescription}</span>
              <textarea
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={w.cardDescriptionPh}
                maxLength={2000}
                rows={3}
              />
            </label>
          </div>
          <div className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
            <label className="field">
              <span className="label inline-flex items-center gap-1.5"><Columns3 className="size-3.5" aria-hidden /> {w.fieldColumn}</span>
              <StatusSelect value={status} onChange={setStatus} />
            </label>
            <label className="field">
              <span className="label inline-flex items-center gap-1.5"><Tag className="size-3.5" aria-hidden /> {w.cardLabel}</span>
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={w.cardLabelPh} maxLength={30} />
            </label>
          </div>
          <div className="rounded-xl border border-line p-4">
            <p className="label mb-2 inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden /> {w.peopleTitle}
            </p>
            <div className="grid gap-4">
              <label className="field">
                <span className="label">{w.cardAssignee}</span>
                <AssigneesPicker ref={assigneesRef} value={assignees} onChange={setAssignees} members={members} placeholder={w.cardAssigneesPh} />
                <span className="mt-1 block text-xs text-muted">{w.cardAssigneesHint}</span>
              </label>
              {teams.length > 0 && (
                <label className="field">
                  <span className="label">{w.cardTeam}</span>
                  <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                    <option value="">{w.cardTeamNone}</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-muted">{w.cardTeamHint}</span>
                </label>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-line p-4">
            <label className="field">
              <span className="label inline-flex items-center gap-1.5"><Calendar className="size-3.5" aria-hidden /> {w.cardDue}</span>
              <input className="input" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </div>
          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={pending}>
              {w.save}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Dropdown tuỳ chỉnh cho cột (trạng thái) ban đầu của việc mới — mỗi cột có icon + màu riêng,
 * cùng quy ước với ColumnSelect trong Chi tiết thẻ (STATUS_ICON/STATUS_TEXT_CLASS). */
function StatusSelect({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const label = (name: string) => w[name as keyof typeof w] ?? name;
  const CurrentIcon = STATUS_ICON[value] || Columns3;
  const currentTextClass = STATUS_TEXT_CLASS[value] || "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="input flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cn("flex min-w-0 flex-1 items-center gap-1.5 font-medium", currentTextClass)}>
          <CurrentIcon className="size-4 shrink-0" aria-hidden /> <span className="truncate">{label(value)}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <ul role="listbox" className="rise absolute z-20 mt-1.5 w-full overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          {DEFAULT_LISTS.map((l) => {
            const Icon = STATUS_ICON[l.name] || Columns3;
            const textClass = STATUS_TEXT_CLASS[l.name] || "";
            const selected = l.name === value;
            return (
              <li key={l.name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn("flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2", textClass)}
                  onClick={() => {
                    onChange(l.name);
                    setOpen(false);
                  }}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate font-medium">{label(l.name)}</span>
                  {selected && <Check className="size-3.5 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
