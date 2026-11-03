"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/cn";
import { updateDepartmentModules } from "@/actions/departments";
import { DEPARTMENT_MODULES, type DepartmentModule } from "@/lib/department-types";
import type { Dict } from "@/lib/i18n/vi";

const MODULE_KEY: Record<DepartmentModule, keyof Dict["departments"]> = {
  overview: "moduleOverview",
  goals: "moduleGoals",
  projects: "moduleProjects",
  tasks: "moduleTasks",
  calendar: "moduleCalendar",
  members: "moduleMembers",
  reports: "moduleReports",
  files: "moduleFiles",
  discussions: "moduleDiscussions",
};

export function ModulesToggle({ departmentId, enabled }: { departmentId: string; enabled: string[] }) {
  const { t } = useI18n();
  const w = t.departments;
  const { exec } = useAction();
  const [selected, setSelected] = useState<Set<string>>(new Set(enabled));

  const toggle = (key: DepartmentModule) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    exec(() => updateDepartmentModules(departmentId, [...next]));
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {DEPARTMENT_MODULES.map((m) => {
        const on = selected.has(m);
        return (
          <button
            key={m}
            type="button"
            onClick={() => toggle(m)}
            aria-pressed={on}
            className={cn("flex items-center justify-between rounded-2xl border px-3 py-2.5 text-left text-sm font-medium", on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2")}
          >
            {w[MODULE_KEY[m]]}
            <span className={cn("size-2 rounded-full", on ? "bg-bg" : "bg-surface-3")} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
