"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

function reducedMotionDuration(d: number) {
  if (typeof window === "undefined") return d;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : d;
}

export function ProgressRing({
  value,
  size = 64,
  stroke = 7,
  color = "var(--accent)",
  track = "var(--surface-2)",
  children,
  label,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const circleRef = useRef<SVGCircleElement>(null);

  useGSAP(
    () => {
      if (!circleRef.current) return;
      gsap.fromTo(
        circleRef.current,
        { strokeDashoffset: c },
        { strokeDashoffset: c * (1 - v), duration: reducedMotionDuration(1.2), ease: "power3.inOut" },
      );
    },
    { dependencies: [v, c], scope: circleRef },
  );

  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(v * 100)}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

export function ProgressBar({ value, color, label }: { value: number; color?: string; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const barRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (!barRef.current) return;
      gsap.fromTo(barRef.current, { width: "0%" }, { width: `${pct}%`, duration: reducedMotionDuration(1), ease: "power3.inOut" });
    },
    { dependencies: [pct], scope: barRef },
  );

  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span ref={barRef} style={{ background: color }} />
    </div>
  );
}
