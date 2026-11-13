"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { createWorkCard } from "@/actions/work";
import { AssigneePicker, type MemberOption } from "./assignee-picker";
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
  const [assignee, setAssignee] = useState("");
  const [teamId, setTeamId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState(DEFAULT_LISTS[0]!.name);
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");

  const reset = () => {
    setLabel("");
    setTitle("");
    setAssignee("");
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
            exec(
              () =>
                createWorkCard({
                  listId,
                  label: label || undefined,
                  title,
                  assignee: assignee || undefined,
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
          <label className="field">
            <span className="label">{w.fieldColumn}</span>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {DEFAULT_LISTS.map((l) => (
                <option key={l.name} value={l.name}>
                  {w[l.name as keyof typeof w] ?? l.name}
                </option>
              ))}
            </select>
          </label>
          {boards.length > 1 && (
            <label className="field">
              <span className="label">{w.newTaskBoardLabel}</span>
              <select className="input" value={boardId} onChange={(e) => setBoardId(e.target.value)}>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span className="label">{w.cardLabel}</span>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={w.cardLabelPh} maxLength={30} />
          </label>
          <label className="field">
            <span className="label">{w.cardAssignee}</span>
            <AssigneePicker value={assignee} onChange={setAssignee} members={members} placeholder={w.cardAssigneePh} />
            <span className="mt-1 block text-xs text-muted">{w.cardAssigneeHint}</span>
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
          <label className="field">
            <span className="label">{w.cardDue}</span>
            <input className="input" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
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
