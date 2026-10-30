"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/** Tiêu đề trang: từng ký tự trượt lên + mờ dần hiện ra khi vào trang. */
export function SplitHeading({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const chars = ref.current.querySelectorAll("[data-char]");
      gsap.fromTo(
        chars,
        { y: reduced ? 0 : 18, opacity: 0 },
        { y: 0, opacity: 1, duration: reduced ? 0 : 0.55, ease: "power3.out", stagger: reduced ? 0 : 0.022 },
      );
    },
    { dependencies: [text], scope: ref },
  );

  return (
    <h1 ref={ref} className={className} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} aria-hidden data-char className="inline-block" style={ch === " " ? { whiteSpace: "pre" } : undefined}>
          {ch}
        </span>
      ))}
    </h1>
  );
}
