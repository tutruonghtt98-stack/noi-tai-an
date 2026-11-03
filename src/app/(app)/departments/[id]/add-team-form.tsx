"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { createTeam } from "@/actions/departments";

export function AddTeamButton({ departmentId }: { departmentId: string }) {
  const { t } = useI18n();
  const w = t.departments;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [leaderEmail, setLeaderEmail] = useState("");

  return (
    <>
      <button type="button" className="btn btn-soft btn-sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {w.addTeam}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.addTeamTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => createTeam(departmentId, { name, leaderEmail: leaderEmail || undefined }), {
              success: w.teamAdded,
              onSuccess: () => {
                setOpen(false);
                setName("");
                setLeaderEmail("");
              },
            });
          }}
        >
          <label className="field">
            <span className="label">{w.fieldTeamName}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus />
          </label>
          <label className="field">
            <span className="label">{w.fieldLeader}</span>
            <input className="input" type="email" value={leaderEmail} onChange={(e) => setLeaderEmail(e.target.value)} placeholder={w.fieldManagerPh} maxLength={160} />
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
