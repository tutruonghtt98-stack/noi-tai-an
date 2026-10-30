"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

type Shape = "number" | "minutes";

const SHAPES: Record<Shape, (n: number, suffix: string, decimals: number) => string> = {
  number: (n, suffix, decimals) => n.toFixed(decimals) + suffix,
  // phút -> "1h05" / "45′" — tránh truyền hàm từ Server Component qua prop (lỗi serialize).
  minutes: (n) => {
    const r = Math.round(n);
    return r >= 60 ? `${Math.floor(r / 60)}h${String(r % 60).padStart(2, "0")}` : `${r}′`;
  },
};

/** Số chạy đếm lên từ 0 khi xuất hiện — dùng cho StatCard. */
export function CountUp({
  value,
  suffix = "",
  decimals = 0,
  shape = "number",
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  /** "minutes" định dạng theo giờ-phút (vd. phút -> "1h05"). */
  shape?: Shape;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const render = (n: number) => SHAPES[shape](n, suffix, decimals);

  useGSAP(
    () => {
      if (!ref.current) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const counter = { n: 0 };
      gsap.to(counter, {
        n: value,
        duration: reduced ? 0 : 1.1,
        ease: "power2.out",
        onUpdate: () => {
          if (ref.current) ref.current.textContent = render(counter.n);
        },
      });
    },
    { dependencies: [value, shape], scope: ref },
  );

  return <span ref={ref}>{render(value)}</span>;
}
