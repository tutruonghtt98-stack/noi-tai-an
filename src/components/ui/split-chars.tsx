"use client";
import { Fragment, useRef } from "react";
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

  const words = text.split(" ");

  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((word, wi) => (
        <Fragment key={wi}>
          <span className="inline-block whitespace-nowrap">
            {[...word].map((ch, ci) => (
              <span key={ci} aria-hidden data-char className="inline-block">
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </span>
  );
}
