"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/** Số chạy đếm lên từ 0 khi xuất hiện — dùng cho StatCard. */
export function CountUp({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

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
          if (ref.current) ref.current.textContent = counter.n.toFixed(decimals) + suffix;
        },
      });
    },
    { dependencies: [value, suffix, decimals], scope: ref },
  );

  return <span ref={ref}>{value.toFixed(decimals) + suffix}</span>;
}
