"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, Archive } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { SegmentLinks } from "@/components/ui/segment-links";
import { createWorkspace, archiveWorkspace } from "@/actions/departments";

export function WorkspaceSwitcher({ workspaces, active, isOwner }: { workspaces: { id: string; name: string }[]; active: string; isOwner: boolean }) {
  const { t } = useI18n();
  const w = t.departments;
  const router = useRouter();
  const pathname = usePathname();
  const { exec, pending } = useAction();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentLinks ariaLabel={w.workspaceSwitcher} active={active} items={workspaces.map((ws) => ({ value: ws.id, href: `${pathname}?w=${ws.id}`, label: ws.name }))} />
      <NewWorkspaceButton />
      {isOwner && workspaces.length > 1 && (
        <button
          type="button"
          className="icon-btn icon-btn-plain shrink-0"
          aria-label={w.confirmDeleteWorkspace}
          title={w.confirmDeleteWorkspace}
          disabled={pending}
          onClick={() => {
            if (!window.confirm(w.confirmDeleteWorkspace)) return;
            exec(() => archiveWorkspace(active), { onSuccess: () => router.push("/departments") });
          }}
        >
          <Archive className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

function NewWorkspaceButton() {
  const { t } = useI18n();
  const w = t.departments;
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <>
      <button type="button" className="btn btn-soft" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {w.newWorkspace}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.newWorkspaceTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => createWorkspace({ name, description: description || undefined }), {
              success: w.workspaceCreated,
              onSuccess: (id) => {
                setOpen(false);
                router.push(`/departments?w=${id}`);
              },
            });
          }}
        >
          <label className="field">
            <span className="label">{w.workspaceName}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={w.workspaceNamePh} required maxLength={100} autoFocus />
          </label>
          <label className="field">
            <span className="label">{w.workspaceDesc}</span>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
          </label>
          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={pending}>
              {w.createWorkspace}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
