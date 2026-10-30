"use client";
import { useRouter } from "next/navigation";
import { RubberSegment, type RubberSegmentSize } from "@/components/ui/rubber-segment";

export type SegmentLink = { value: string; label: React.ReactNode; href: string };

/** Thanh tab điều hướng dạng viên nang "cao su" — bọc RubberSegment để điều hướng qua router.push. */
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
    <RubberSegment
      aria-label={ariaLabel}
      items={items.map(({ value, label }) => ({ value, label }))}
      value={active}
      size={size}
      className={className}
      onChange={(value) => {
        const item = items.find((i) => i.value === value);
        if (item) router.push(item.href);
      }}
    />
  );
}
