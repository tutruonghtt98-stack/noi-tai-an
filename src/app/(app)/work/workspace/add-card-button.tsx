"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { createWorkCard } from "@/actions/work";

export function AddCardButton({ listId }: { listId: string }) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");

  const reset = () => {
    setLabel("");
    setTitle("");
    setAssignee("");
    setDueDate("");
  };

  return (
    <>
      <button type="button" className="icon-btn icon-btn-plain size-7" aria-label={w.addCard} title={w.addCard} onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.addCardTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(
              () =>
                createWorkCard({
                  listId,
                  label: label || undefined,
                  title,
                  assignee: assignee || undefined,
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
            <span className="label">{w.cardLabel}</span>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={w.cardLabelPh} maxLength={30} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">{w.cardAssignee}</span>
              <input className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder={w.cardAssigneePh} maxLength={60} />
            </label>
            <label className="field">
              <span className="label">{w.cardDue}</span>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
