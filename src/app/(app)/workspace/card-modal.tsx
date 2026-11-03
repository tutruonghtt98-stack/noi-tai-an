"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/modal";
import { deleteWorkCard, updateWorkCard, updateWorkCardChecklist } from "@/actions/work";
import type { ChecklistItem } from "@/lib/work-types";

export type SerializedCard = {
  id: string;
  label: string | null;
  title: string;
  assignee: string | null;
  dueDate: string | null;
  checklist: ChecklistItem[];
};

export function CardModal({
  open,
  card,
  listId,
  lists,
  onClose,
}: {
  open: boolean;
  card: SerializedCard | null;
  listId: string;
  lists: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const { exec, pending } = useAction();
  const [title, setTitle] = useState("");
  const [label, setLabel] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [column, setColumn] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setLabel(card.label ?? "");
    setAssignee(card.assignee ?? "");
    setDueDate(card.dueDate ? card.dueDate.slice(0, 10) : "");
    setColumn(listId);
    setChecklist(card.checklist);
  }, [card, listId]);

  if (!card) return null;

  const persistChecklist = (next: ChecklistItem[]) => {
    setChecklist(next);
    exec(() => updateWorkCardChecklist(card.id, next));
  };

  const toggleItem = (id: string) => persistChecklist(checklist.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const removeItem = (id: string) => persistChecklist(checklist.filter((i) => i.id !== id));
  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    persistChecklist([...checklist, { id: crypto.randomUUID(), text, done: false }]);
    setNewItem("");
  };

  const saveInfo = () => {
    exec(
      () =>
        updateWorkCard(card.id, {
          listId: column,
          label: label || undefined,
          title,
          assignee: assignee || undefined,
          dueDate: dueDate || undefined,
        }),
      { success: w.cardUpdated, onSuccess: onClose },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={w.cardDetailTitle}>
      <div className="grid gap-4">
        <label className="field">
          <span className="label">{w.cardTitle}</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} autoFocus />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span className="label">{w.fieldColumn}</span>
            <select className="input" value={column} onChange={(e) => setColumn(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">{w.cardLabel}</span>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={w.cardLabelPh} maxLength={30} />
          </label>
        </div>
        <label className="field">
          <span className="label">{w.cardAssignee}</span>
          <input className="input" type="email" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder={w.cardAssigneePh} maxLength={160} />
          <span className="mt-1 block text-xs text-muted">{w.cardAssigneeHint}</span>
        </label>
        <label className="field">
          <span className="label">{w.cardDue}</span>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>

        <div>
          <p className="label mb-2">{w.checklistTitle}</p>
          {checklist.length === 0 ? (
            <p className="text-sm text-muted">{w.checklistEmpty}</p>
          ) : (
            <ul className="space-y-1.5">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 shrink-0 accent-[var(--ink)]" checked={item.done} onChange={() => toggleItem(item.id)} />
                  <span className={cn("flex-1 text-sm", item.done && "text-muted line-through")}>{item.text}</span>
                  <button type="button" className="icon-btn icon-btn-plain size-6 shrink-0" onClick={() => removeItem(item.id)} aria-label={w.deleteCardBtn}>
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <input
              className="input flex-1"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder={w.checklistAddPh}
              maxLength={200}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <button type="button" className="btn btn-soft" onClick={addItem}>
              {w.checklistAdd}
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-4">
          <button
            type="button"
            className="text-sm font-medium text-danger"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(w.deleteCard)) return;
              exec(() => deleteWorkCard(card.id), { success: w.cardDeleted, onSuccess: onClose });
            }}
          >
            {w.deleteCardBtn}
          </button>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={saveInfo}>
            {w.save}
          </button>
        </div>
      </div>
    </Modal>
  );
}
