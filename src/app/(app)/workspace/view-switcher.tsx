import { SegmentLinks } from "@/components/ui/segment-links";
import type { Dict } from "@/lib/i18n/vi";

export function ViewSwitcher({ active, assignedCount, w }: { active: "boards" | "assigned"; assignedCount: number; w: Dict["work"]["workspace"] }) {
  return (
    <SegmentLinks
      ariaLabel={w.title}
      active={active}
      items={[
        { value: "boards", href: "/workspace", label: w.myBoards },
        { value: "assigned", href: "/workspace/assigned", label: assignedCount > 0 ? `${w.assignedToMe} ${assignedCount}` : w.assignedToMe },
      ]}
    />
  );
}
