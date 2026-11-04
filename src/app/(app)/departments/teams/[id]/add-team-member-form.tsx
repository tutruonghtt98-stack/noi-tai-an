"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { addTeamMember } from "@/actions/departments";

export function AddTeamMemberButton({ teamId }: { teamId: string }) {
  const { t } = useI18n();
  const w = t.departments;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <>
      <button type="button" className="btn btn-soft btn-sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {w.addMember}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.addTeamMemberTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => addTeamMember(teamId, email), {
              success: w.teamMemberAdded,
              onSuccess: () => {
                setOpen(false);
                setEmail("");
              },
            });
          }}
        >
          <label className="field">
            <span className="label">{w.fieldEmail}</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={w.fieldEmailPh} required maxLength={160} autoFocus />
            <span className="mt-1 block text-xs text-muted">{w.inviteHint}</span>
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
