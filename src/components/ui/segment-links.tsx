import Link from "next/link";
import { cn } from "@/lib/cn";

export type SegmentLink = { value: string; label: React.ReactNode; href: string };

/** Dãy chip lọc/tab rời nhau, mỗi mục một viên nang riêng (kiểu Corbel) — mục đang chọn nền đen. */
export function SegmentLinks({
  items,
  active,
  ariaLabel,
  className,
}: {
  items: SegmentLink[];
  active: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item) => {
        const isActive = item.value === active;
        return (
          <Link
            key={item.value}
            href={item.href}
            role="radio"
            aria-checked={isActive}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors",
              isActive ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
