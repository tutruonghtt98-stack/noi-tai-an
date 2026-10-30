"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { SegmentLinks } from "@/components/ui/segment-links";
import { createWorkBoard, deleteWorkBoard } from "@/actions/work";

export function BoardSwitcher({ boards, active }: { boards: { id: string; name: string; cards: number }[]; active?: string }) {
  const { t } = useI18n();
  if (!boards.length) return null;
  return (
    <SegmentLinks
      ariaLabel={t.work.workspace.title}
      active={active ?? boards[0]!.id}
      items={boards.map((b) => ({
        value: b.id,
        href: `/work/workspace?b=${b.id}`,
        label: b.cards > 0 ? `${b.name} ${b.cards}` : b.name,
      }))}
    />
  );
}

export function NewBoardButton({ primary = false }: { primary?: boolean }) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

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
            exec(() => createWorkBoard({ name, description: description || undefined, dueDate: dueDate || undefined }), {
              success: w.boardCreated,
              onSuccess: (id) => {
                setOpen(false);
                router.push(`/work/workspace?b=${id}`);
              },
            });
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
          onSuccess: () => router.push("/work/workspace"),
        });
      }}
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}
