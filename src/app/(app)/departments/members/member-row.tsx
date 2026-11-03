"use client";
import { Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { inviteWorkspaceMember, removeWorkspaceMember } from "@/actions/departments";

type Role = "ADMIN" | "MEMBER";

export function WorkspaceMemberRow({ workspaceId, userId, email, role }: { workspaceId: string; userId: string; email: string; role: Role }) {
  const { t } = useI18n();
  const w = t.departments;
  const { exec, pending } = useAction();
  const roleLabel: Record<Role, string> = { ADMIN: w.roleAdmin, MEMBER: w.roleMember };

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label={w.fieldRole}
        className="h-7 rounded-full border-0 bg-surface-2 px-2 text-xs text-ink-2"
        value={role}
        disabled={pending}
        onChange={(e) => e.target.value !== role && exec(() => inviteWorkspaceMember(workspaceId, email, e.target.value as Role))}
      >
        {(["ADMIN", "MEMBER"] as Role[]).map((r) => (
          <option key={r} value={r}>
            {roleLabel[r]}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="icon-btn icon-btn-plain size-7"
        aria-label={w.removeMember}
        title={w.removeMember}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(w.removeMember)) return;
          exec(() => removeWorkspaceMember(workspaceId, userId), { success: w.removed });
        }}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
