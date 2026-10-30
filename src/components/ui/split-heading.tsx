"use client";
import { SplitChars } from "@/components/ui/split-chars";

/** Tiêu đề trang: từng ký tự trượt lên + mờ dần hiện ra khi vào trang. */
export function SplitHeading({ text, className }: { text: string; className?: string }) {
  return (
    <h1 className={className}>
      <SplitChars text={text} />
    </h1>
  );
}
