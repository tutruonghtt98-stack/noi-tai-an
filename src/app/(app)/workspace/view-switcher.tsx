import Link from "next/link";
import type { Dict } from "@/lib/i18n/vi";
import type { WorkView } from "@/lib/work-view";

export function ViewSwitcher({ w, current }: { w: Dict["work"]["workspace"]; current: WorkView }) {
  const views: { key: WorkView; label: string }[] = [
    { key: "kanban", label: w.viewKanban },
    { key: "list", label: w.viewList },
    { key: "calendar", label: w.viewCalendar },
  ];
  return (
    <div className="wsx-tabs">
      {views.map((v) => (
        <Link key={v.key} href={`/workspace?v=${v.key}`} aria-current={v.key === current ? "page" : undefined}>
          {v.label}
        </Link>
      ))}
    </div>
  );
}
