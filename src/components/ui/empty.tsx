import type { LucideIcon } from "lucide-react";

export function Empty({ icon: Icon, text, children }: { icon: LucideIcon; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-line px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="max-w-xs text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}
