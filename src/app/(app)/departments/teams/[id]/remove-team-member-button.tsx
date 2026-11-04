"use client";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { removeTeamMember } from "@/actions/departments";

export function RemoveTeamMemberButton({ teamId, userId }: { teamId: string; userId: string }) {
  const { t } = useI18n();
  const w = t.departments;
  const { exec, pending } = useAction();

  return (
    <button
      type="button"
      className="icon-btn icon-btn-plain size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      aria-label={w.removeTeamMemberConfirm}
      title={w.removeTeamMemberConfirm}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(w.removeTeamMemberConfirm)) return;
        exec(() => removeTeamMember(teamId, userId), { success: w.teamMemberRemoved });
      }}
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}
