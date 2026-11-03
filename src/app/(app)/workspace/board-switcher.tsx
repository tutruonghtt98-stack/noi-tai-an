"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { SegmentLinks } from "@/components/ui/segment-links";
import { createWorkBoard, deleteWorkBoard, updateWorkBoard } from "@/actions/work";

export function BoardSwitcher({
  boards,
  active,
}: {
  boards: { id: string; name: string; inProgress: number; overdue: number }[];
  active?: string;
}) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const items = boards.map((b) => ({
    value: b.id,
    href: `/workspace?b=${b.id}`,
    label:
      b.inProgress > 0 || b.overdue > 0 ? (
        <>
          {b.name}{" "}
          <span>
            (<span className="text-mist-ink">{b.inProgress}</span>
            {b.overdue > 0 && (
              <>
                ,<span className="text-danger">{b.overdue}</span>
              </>
            )}
            )
          </span>
        </>
      ) : (
        b.name
      ),
  }));
  if (!items.length) return null;
  return <SegmentLinks ariaLabel={w.title} active={active ?? items[0]!.value} items={items} />;
}

export function NewBoardButton({ primary = false, teams = [] }: { primary?: boolean; teams?: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState("");
  const [teamId, setTeamId] = useState("");

  const reset = () => {
    setName("");
    setDescription("");
    setDueDate("");
    setAssignee("");
    setTeamId("");
  };

  return (
    <>
      <button type="button" className={primary ? "btn btn-primary" : "btn btn-soft"} onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {w.newBoard}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.newBoardTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(
              () =>
                createWorkBoard({
                  name,
                  description: description || undefined,
                  dueDate: dueDate || undefined,
                  assignee: assignee || undefined,
                  teamId: teamId || undefined,
                }),
              {
                success: w.boardCreated,
                onSuccess: (id) => {
                  setOpen(false);
                  reset();
                  router.push(`/workspace?b=${id}`);
                },
              },
            );
          }}
        >
          <label className="field">
            <span className="label">{w.boardName}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={w.boardNamePh} required maxLength={100} autoFocus />
          </label>
          <label className="field">
            <span className="label">{w.boardDesc}</span>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={w.boardDescPh} maxLength={200} />
          </label>
          <label className="field">
            <span className="label">{w.boardDue}</span>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">{w.boardAssignee}</span>
            <input className="input" type="email" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder={w.boardAssigneePh} maxLength={160} />
            <span className="mt-1 block text-xs text-muted">{w.boardAssigneeHint}</span>
          </label>
          {teams.length > 0 && (
            <label className="field">
              <span className="label">{w.boardTeam}</span>
              <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">{w.boardTeamNone}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">{w.boardTeamHint}</span>
            </label>
          )}
          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={pending}>
              {w.createBoard}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

type BoardInfo = {
  id: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  assignee: string | null;
  teamId: string | null;
};

/** Thanh thông tin bảng ở đầu trang Workspace — bấm vào (khi là chủ bảng) để mở popup chỉnh sửa tên/mô tả/hạn/người-team phụ trách. */
export function BoardHeaderCard({
  board,
  title,
  shared,
  ownerName,
  dueText,
  cardsText,
  progressPct,
  progressText,
  canManage,
  teams = [],
}: {
  board: BoardInfo;
  title: string;
  shared: boolean;
  ownerName: string | null;
  dueText: string;
  cardsText: string;
  progressPct: number;
  progressText: string;
  canManage: boolean;
  teams?: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? "");
  const [dueDate, setDueDate] = useState(board.dueDate ? board.dueDate.slice(0, 10) : "");
  const [assignee, setAssignee] = useState(board.assignee ?? "");
  const [teamId, setTeamId] = useState(board.teamId ?? "");

  const openEdit = () => {
    if (!canManage) return;
    setName(board.name);
    setDescription(board.description ?? "");
    setDueDate(board.dueDate ? board.dueDate.slice(0, 10) : "");
    setAssignee(board.assignee ?? "");
    setTeamId(board.teamId ?? "");
    setOpen(true);
  };

  const saveBoard = () => {
    exec(
      () =>
        updateWorkBoard(board.id, {
          name,
          description: description || undefined,
          dueDate: dueDate || undefined,
          assignee: assignee || undefined,
          teamId: teamId || undefined,
        }),
      { success: w.boardUpdated, onSuccess: () => setOpen(false) },
    );
  };

  return (
    <>
      <section className="card mb-5 flex flex-wrap items-center justify-between gap-4" aria-label={title}>
        <div
          className={canManage ? "flex min-w-0 cursor-pointer items-center gap-3" : "flex min-w-0 items-center gap-3"}
          role={canManage ? "button" : undefined}
          tabIndex={canManage ? 0 : undefined}
          onClick={openEdit}
        >
          <span className="size-2.5 shrink-0 rounded-full bg-ink" aria-hidden />
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              {title}
              {shared && <span className="chip chip-soft text-xs">{w.sharedBoardBadge}</span>}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {dueText} · {cardsText}
              {shared && ownerName ? ` · ${fmt(w.ownerLabel, { name: ownerName })}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="progress w-32">
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <span className="tabular text-sm text-ink-2">{progressText}</span>
          {canManage && <DeleteBoardButton boardId={board.id} />}
        </div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title={w.editBoardTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveBoard();
          }}
        >
          <label className="field">
            <span className="label">{w.boardName}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={w.boardNamePh} required maxLength={100} autoFocus />
          </label>
          <label className="field">
            <span className="label">{w.boardDesc}</span>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={w.boardDescPh} maxLength={200} />
          </label>
          <label className="field">
            <span className="label">{w.boardDue}</span>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">{w.boardAssignee}</span>
            <input className="input" type="email" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder={w.boardAssigneePh} maxLength={160} />
            <span className="mt-1 block text-xs text-muted">{w.boardAssigneeHint}</span>
          </label>
          {teams.length > 0 && (
            <label className="field">
              <span className="label">{w.boardTeam}</span>
              <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">{w.boardTeamNone}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted">{w.boardTeamHint}</span>
            </label>
          )}
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

export function DeleteBoardButton({ boardId }: { boardId: string }) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const router = useRouter();
  const { exec, pending } = useAction();

  return (
    <button
      type="button"
      className="icon-btn icon-btn-plain shrink-0"
      aria-label={w.deleteBoard}
      title={w.deleteBoard}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(w.deleteBoard)) return;
        exec(() => deleteWorkBoard(boardId), {
          onSuccess: () => router.push("/workspace"),
        });
      }}
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}
