"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { updateTeam } from "@/actions/departments";

export function EditTeamButton({ teamId, name, leaderEmail }: { teamId: string; name: string; leaderEmail: string | null }) {
  const { t } = useI18n();
  const w = t.departments;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState(name);
  const [leader, setLeader] = useState(leaderEmail ?? "");

  const openEdit = () => {
    setTeamName(name);
    setLeader(leaderEmail ?? "");
    setOpen(true);
  };

  return (
    <>
      <button type="button" className="icon-btn icon-btn-plain" aria-label={w.edit} title={w.edit} onClick={openEdit}>
        <Pencil className="size-4" aria-hidden />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.editTeamTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => updateTeam(teamId, { name: teamName, leaderEmail: leader || undefined }), {
              success: w.teamUpdated,
              onSuccess: () => setOpen(false),
            });
          }}
        >
          <label className="field">
            <span className="label">{w.fieldTeamName}</span>
            <input className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)} required maxLength={100} autoFocus />
          </label>
          <label className="field">
            <span className="label">{w.fieldLeader}</span>
            <input className="input" type="email" value={leader} onChange={(e) => setLeader(e.target.value)} placeholder={w.fieldManagerPh} maxLength={160} />
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
