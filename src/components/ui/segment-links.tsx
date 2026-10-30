"use client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { RubberSegment, type RubberSegmentSize } from "@/components/ui/rubber-segment";

export type SegmentLink = { value: string; label: React.ReactNode; href: string };

/**
 * Thanh tab điều hướng dạng viên nang "cao su" — bọc RubberSegment để điều hướng qua
 * router.push, đặt trong khung nền trắng (giống thanh nav chính) thay vì nổi trần.
 */
export function SegmentLinks({
  items,
  active,
  ariaLabel,
  size = "md",
  className,
}: {
  items: SegmentLink[];
  active: string;
  ariaLabel: string;
  size?: RubberSegmentSize;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div className={cn("inline-flex max-w-full rounded-full bg-surface p-1.5 shadow-card", className)}>
      <RubberSegment
        aria-label={ariaLabel}
        items={items.map(({ value, label }) => ({ value, label }))}
        value={active}
        size={size}
        trackColor="transparent"
        className="max-w-full overflow-x-auto"
        onChange={(value) => {
          const item = items.find((i) => i.value === value);
          if (item) router.push(item.href);
        }}
      />
    </div>
  );
}
