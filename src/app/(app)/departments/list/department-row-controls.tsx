"use client";
import { Archive, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { archiveDepartment, deleteDepartment } from "@/actions/departments";

export function DepartmentRowControls({ departmentId, canDelete }: { departmentId: string; canDelete: boolean }) {
  const { t } = useI18n();
  const w = t.departments;
  const { exec, pending } = useAction();

  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        className="icon-btn icon-btn-plain size-7"
        aria-label={w.archiveDepartment}
        title={w.archiveDepartment}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(w.archiveDepartment)) return;
          exec(() => archiveDepartment(departmentId), { success: w.archived });
        }}
      >
        <Archive className="size-3.5" aria-hidden />
      </button>
      {canDelete && (
        <button
          type="button"
          className="icon-btn icon-btn-plain size-7"
          aria-label={w.deleteDepartment}
          title={w.deleteDepartment}
          disabled={pending}
          onClick={() => {
            if (!window.confirm(w.deleteDepartment)) return;
            exec(() => deleteDepartment(departmentId), { success: w.deleted });
          }}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
