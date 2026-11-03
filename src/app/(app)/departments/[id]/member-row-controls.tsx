"use client";
import { Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { updateDepartmentMemberRole, removeDepartmentMember } from "@/actions/departments";

type Role = "MANAGER" | "MEMBER" | "VIEWER";

export function MemberRowControls({ departmentId, userId, role, isManagerUser }: { departmentId: string; userId: string; role: string; isManagerUser: boolean }) {
  const { t } = useI18n();
  const w = t.departments;
  const { exec, pending } = useAction();
  const roleLabel: Record<Role, string> = { MANAGER: w.roleManager, MEMBER: w.roleMember, VIEWER: w.roleViewer };

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label={w.fieldRole}
        className="h-7 rounded-full border-0 bg-surface-2 px-2 text-xs text-ink-2"
        value={role}
        disabled={pending}
        onChange={(e) => e.target.value !== role && exec(() => updateDepartmentMemberRole(departmentId, userId, e.target.value as Role))}
      >
        {(["MANAGER", "MEMBER", "VIEWER"] as Role[]).map((r) => (
          <option key={r} value={r}>
            {roleLabel[r]}
          </option>
        ))}
      </select>
      {!isManagerUser && (
        <button
          type="button"
          className="icon-btn icon-btn-plain size-7"
          aria-label={w.removeMember}
          title={w.removeMember}
          disabled={pending}
          onClick={() => {
            if (!window.confirm(w.removeMember)) return;
            exec(() => removeDepartmentMember(departmentId, userId), { success: w.removed });
          }}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
