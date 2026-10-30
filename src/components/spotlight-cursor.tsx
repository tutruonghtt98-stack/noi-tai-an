"use client";
import { useEffect } from "react";

/**
 * Theo dõi con trỏ toàn cục và cập nhật --spot-x/--spot-y cho thẻ `.card` đang
 * được rê chuột, để CSS vẽ hiệu ứng "spotlight" đi theo chuột (globals.css).
 * Không re-render React — chỉ ghi thẳng CSS custom property, rAF-throttled.
 */
export function SpotlightCursor() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let lastEvent: PointerEvent | null = null;

    const apply = () => {
      raf = 0;
      const event = lastEvent;
      if (!event) return;
      const el = (event.target as Element | null)?.closest<HTMLElement>(".card");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      el.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
    };

    const onMove = (event: PointerEvent) => {
      lastEvent = event;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
