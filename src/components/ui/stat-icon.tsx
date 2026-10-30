"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/** Vòng icon bật nảy nhẹ khi xuất hiện — dùng cho StatCard. */
export function StatIcon({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.from(ref.current, { scale: 0, opacity: 0, duration: reduced ? 0 : 0.6, ease: "back.out(2.6)", delay: reduced ? 0 : 0.2 });
    },
    { scope: ref },
  );

  return (
    <span
      ref={ref}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink-2 shadow-card transition-transform group-hover:rotate-45"
    >
      {children}
    </span>
  );
}
