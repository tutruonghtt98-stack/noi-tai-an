"use client";
import { Effects, type EffectsProps } from "@animate-ui/react/primitives/effects/effect";

/** Bọc client cho primitive Effects — cho phép dùng hiệu ứng xuất hiện (mờ dần/nhòe-rõ/trượt vào, so le
 * từng phần tử) trong các trang server component bằng cách truyền JSX đã dựng sẵn làm children. */
export function StaggerReveal({ children, holdDelay = 60, fade = true, blur = true, slide = true, ...props }: EffectsProps) {
  return (
    <Effects asChild fade={fade} blur={blur} slide={slide} holdDelay={holdDelay} {...props}>
      {children}
    </Effects>
  );
}
