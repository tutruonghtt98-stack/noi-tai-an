"use client";
import { useEffect, useRef, useState } from "react";
import { Calendar, ListChecks, MessageSquare, Paperclip, Tag, Users, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/cn";
import {
  addWorkCardAttachment,
  addWorkCardComment,
  deleteWorkCard,
  deleteWorkCardAttachment,
  listWorkCardAttachments,
  listWorkCardComments,
  moveWorkCard,
  updateWorkCard,
  updateWorkCardChecklist,
} from "@/actions/work";
import { Avatar } from "@/components/ui/avatar";
import { AssigneePicker, type MemberOption } from "./assignee-picker";
import { utcToZonedDateTimeInput } from "@/lib/dates";
import type { ChecklistItem } from "@/lib/work-types";

type CardComment = { id: string; content: string; createdAt: string; userName: string | null; userImage: string | null };
type CardAttachment = { id: string; url: string; label: string | null };

export type SerializedCard = {
  id: string;
  label: string | null;
  title: string;
  assignee: string | null;
  teamId: string | null;
  dueDate: string | null;
  startDate: string | null;
  checklist: ChecklistItem[];
};

export function CardModal({
  open,
  card,
  listId,
  lists,
  teams = [],
  members = [],
  reviewListId,
  doneListId,
  onClose,
  canDelete = true,
  timezone,
}: {
  open: boolean;
  card: SerializedCard | null;
  listId: string;
  lists: { id: string; name: string }[];
  teams?: { id: string; name: string }[];
  members?: MemberOption[];
  reviewListId?: string;
  doneListId?: string;
  onClose: () => void;
  canDelete?: boolean;
  timezone: string;
}) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const { exec, pending } = useAction();
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [label, setLabel] = useState("");
  const [assignee, setAssignee] = useState("");
  const [teamId, setTeamId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [column, setColumn] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [comments, setComments] = useState<CardComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [attachments, setAttachments] = useState<CardAttachment[]>([]);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [newAttachmentLabel, setNewAttachmentLabel] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setLabel(card.label ?? "");
    setAssignee(card.assignee ?? "");
    setTeamId(card.teamId ?? "");
    setDueDate(card.dueDate ? utcToZonedDateTimeInput(new Date(card.dueDate), timezone) : "");
    setStartDate(card.startDate ? utcToZonedDateTimeInput(new Date(card.startDate), timezone) : "");
    setColumn(listId);
    setChecklist(card.checklist);
    setComments([]);
    setAttachments([]);
    listWorkCardComments(card.id).then((res) => {
      if (res.ok) setComments(res.data);
    });
    listWorkCardAttachments(card.id).then((res) => {
      if (res.ok) setAttachments(res.data);
    });
  }, [card, listId, timezone]);

  const postComment = () => {
    if (!card) return;
    const text = newComment.trim();
    if (!text) return;
    exec(() => addWorkCardComment(card.id, text), {
      success: w.commentSent,
      onSuccess: () => {
        setNewComment("");
        listWorkCardComments(card.id).then((res) => {
          if (res.ok) setComments(res.data);
        });
      },
    });
  };

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
  const setItemDescription = (id: string, description: string) =>
    setChecklist(checklist.map((i) => (i.id === id ? { ...i, description: description || undefined } : i)));

  const addAttachment = () => {
    const url = newAttachmentUrl.trim();
    if (!url) return;
    exec(() => addWorkCardAttachment(card.id, { url, label: newAttachmentLabel.trim() || undefined }), {
      success: w.attachmentAdded,
      onSuccess: () => {
        setNewAttachmentUrl("");
        setNewAttachmentLabel("");
        listWorkCardAttachments(card.id).then((res) => {
          if (res.ok) setAttachments(res.data);
        });
      },
    });
  };
  const removeAttachment = (id: string) => {
    exec(() => deleteWorkCardAttachment(id), {
      success: w.attachmentDeleted,
      onSuccess: () => setAttachments((prev) => prev.filter((a) => a.id !== id)),
    });
  };

  const saveInfo = () => {
    exec(
      () =>
        updateWorkCard(card.id, {
          listId: column,
          label: label || undefined,
          title,
          assignee: assignee || undefined,
          teamId: teamId || undefined,
          dueDate: dueDate || undefined,
          startDate: startDate || undefined,
        }),
      { success: w.cardUpdated, onSuccess: onClose },
    );
  };

  const approveCard = () => {
    if (!doneListId) return;
    exec(() => moveWorkCard(card.id, doneListId), { success: w.cardApproved, onSuccess: onClose });
  };

  const showApprove = canDelete && !!reviewListId && !!doneListId && column === reviewListId;
  // Thẻ đã được duyệt (nằm ở cột Hoàn thành) — chỉ chủ bảng mới được sửa, người khác chỉ xem.
  const locked = !canDelete && !!doneListId && column === doneListId;

  return (
    <dialog
      ref={ref}
      className="side-panel"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <>
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line p-5">
            <h2 className="text-lg font-semibold">{w.cardDetailTitle}</h2>
            <button type="button" className="icon-btn icon-btn-plain" onClick={onClose} aria-label={t.common.close}>
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="grid min-h-0 min-w-0 flex-1 gap-4 overflow-y-auto p-5">
            {locked && <p className="rounded-xl bg-surface-3 px-3 py-2 text-sm text-muted">{w.cardLocked}</p>}
            <label className="field">
              <span className="label">{w.cardTitle}</span>
              <input
                className="input !h-auto border-transparent bg-transparent !px-0 text-xl font-semibold shadow-none focus:border-line focus:bg-surface-2/60 focus:px-3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                autoFocus
                disabled={locked}
              />
            </label>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="field">
                <span className="label">{w.fieldColumn}</span>
                <select className="input" value={column} onChange={(e) => setColumn(e.target.value)} disabled={locked}>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label inline-flex items-center gap-1.5">
                  <Tag className="size-3.5" aria-hidden /> {w.typeTitle}
                </span>
                <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={w.cardLabelPh} maxLength={30} disabled={locked} />
              </label>
            </div>

            <div>
              <p className="label mb-2 inline-flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden /> {w.peopleTitle}
              </p>
              <div className="grid gap-4">
                <label className="field">
                  <span className="label">{w.cardAssignee}</span>
                  <AssigneePicker value={assignee} onChange={setAssignee} members={members} placeholder={w.cardAssigneePh} disabled={!canDelete || locked} />
                  <span className="mt-1 block text-xs text-muted">{w.cardAssigneeHint}</span>
                </label>
                {canDelete && teams.length > 0 && (
                  <label className="field">
                    <span className="label">{w.cardTeam}</span>
                    <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={locked}>
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

            <div>
              <p className="label mb-2 inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" aria-hidden /> {w.timelineTitle}
              </p>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="field min-w-0">
                  <span className="label">{w.startDateLabel}</span>
                  <input className="input w-full min-w-0" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={locked} />
                </label>
                <label className="field min-w-0">
                  <span className="label">{w.cardDue}</span>
                  <input className="input w-full min-w-0" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={locked} />
                </label>
              </div>
            </div>

            <div>
              <p className="label mb-2 inline-flex items-center gap-1.5">
                <ListChecks className="size-3.5" aria-hidden /> {w.checklistTitle}
                {checklist.length > 0 && <span className="tabular text-muted">({checklist.filter((i) => i.done).length}/{checklist.length})</span>}
              </p>
              {checklist.length === 0 ? (
                <p className="text-sm text-muted">{w.checklistEmpty}</p>
              ) : (
                <ul className="space-y-2">
                  {checklist.map((item) => (
                    <li key={item.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-4 shrink-0 accent-[var(--ink)]"
                          checked={item.done}
                          onChange={() => toggleItem(item.id)}
                          disabled={locked}
                        />
                        <span className={cn("flex-1 text-sm", item.done && "text-muted line-through")}>{item.text}</span>
                        {!locked && (
                          <button type="button" className="icon-btn icon-btn-plain size-6 shrink-0" onClick={() => removeItem(item.id)} aria-label={w.deleteCardBtn}>
                            <X className="size-3.5" aria-hidden />
                          </button>
                        )}
                      </div>
                      <input
                        className="input ml-6 !h-8 text-xs"
                        value={item.description ?? ""}
                        onChange={(e) => setItemDescription(item.id, e.target.value)}
                        onBlur={() => persistChecklist(checklist)}
                        placeholder={w.subtaskDescriptionPh}
                        maxLength={300}
                        disabled={locked}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {!locked && (
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
              )}
            </div>

            <div>
              <p className="label mb-2 inline-flex items-center gap-1.5">
                <Paperclip className="size-3.5" aria-hidden /> {w.attachmentsTitle}
                {attachments.length > 0 && <span className="tabular text-muted">({attachments.length})</span>}
              </p>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted">{w.attachmentsEmpty}</p>
              ) : (
                <ul className="space-y-1.5">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2">
                      <Paperclip className="size-4 shrink-0 text-muted" aria-hidden />
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm hover:underline">
                        {a.label || a.url}
                      </a>
                      {!locked && (
                        <button
                          type="button"
                          className="icon-btn icon-btn-plain size-6 shrink-0"
                          onClick={() => removeAttachment(a.id)}
                          aria-label={w.deleteCardBtn}
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!locked && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    className="input flex-1"
                    value={newAttachmentUrl}
                    onChange={(e) => setNewAttachmentUrl(e.target.value)}
                    placeholder={w.attachmentUrlPh}
                    maxLength={2000}
                  />
                  <input
                    className="input flex-1"
                    value={newAttachmentLabel}
                    onChange={(e) => setNewAttachmentLabel(e.target.value)}
                    placeholder={w.attachmentLabelPh}
                    maxLength={80}
                  />
                  <button type="button" className="btn btn-soft" onClick={addAttachment}>
                    {w.attachmentAdd}
                  </button>
                </div>
              )}
            </div>

            <div>
              <p className="label mb-2 inline-flex items-center gap-1.5">
                <MessageSquare className="size-3.5" aria-hidden /> {w.commentsTitle}
                {comments.length > 0 && <span className="tabular text-muted">({comments.length})</span>}
              </p>
              {comments.length === 0 ? (
                <p className="text-sm text-muted">{w.commentsEmpty}</p>
              ) : (
                <ul className="space-y-3">
                  {comments.map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <Avatar name={c.userName ?? "?"} image={c.userImage} size={24} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted">{c.userName ?? "?"}</p>
                        <p className="text-sm">{c.content}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  className="input flex-1"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={w.commentPh}
                  maxLength={1000}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      postComment();
                    }
                  }}
                />
                <button type="button" className="btn btn-soft" disabled={pending} onClick={postComment}>
                  {w.commentSend}
                </button>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line p-5">
            {canDelete ? (
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
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {showApprove && (
                <button type="button" className="btn btn-soft text-jade-ink" disabled={pending} onClick={approveCard}>
                  {w.approveCard}
                </button>
              )}
              {locked ? (
                <button type="button" className="btn btn-soft" onClick={onClose}>
                  {t.common.close}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" disabled={pending} onClick={saveInfo}>
                  {w.save}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}
