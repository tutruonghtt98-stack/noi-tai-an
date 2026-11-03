"use client";
import { Archive } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { archiveTeam } from "@/actions/departments";

export function TeamRowControls({ teamId }: { teamId: string }) {
  const { t } = useI18n();
  const w = t.departments;
  const { exec, pending } = useAction();

  return (
    <button
      type="button"
      className="icon-btn icon-btn-plain size-7 opacity-0 transition-opacity group-hover:opacity-100"
      aria-label={w.archiveTeam}
      title={w.archiveTeam}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(w.archiveTeam)) return;
        exec(() => archiveTeam(teamId), { success: w.teamArchived });
      }}
    >
      <Archive className="size-3.5" aria-hidden />
    </button>
  );
}
