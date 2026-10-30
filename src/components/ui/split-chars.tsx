"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/** Đoạn chữ ngắn (tiêu đề thẻ, lời chào...): từng ký tự trượt lên + mờ dần khi vào trang. */
export function SplitChars({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const chars = ref.current.querySelectorAll("[data-char]");
      gsap.fromTo(
        chars,
        { y: reduced ? 0 : 14, opacity: 0 },
        { y: 0, opacity: 1, duration: reduced ? 0 : 0.5, ease: "power3.out", stagger: reduced ? 0 : 0.02, delay: reduced ? 0 : delay },
      );
    },
    { dependencies: [text], scope: ref },
  );

  return (
    <span ref={ref} className={className} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} aria-hidden data-char className="inline-block" style={ch === " " ? { whiteSpace: "pre" } : undefined}>
          {ch}
        </span>
      ))}
    </span>
  );
}
