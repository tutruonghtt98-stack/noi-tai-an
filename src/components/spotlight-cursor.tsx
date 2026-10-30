"use client";
import { useEffect } from "react";

/**
 * Theo dõi con trỏ toàn cục và cập nhật --spot-x/--spot-y cho thẻ `.card` đang
 * được rê chuột, để CSS vẽ hiệu ứng "spotlight" + viền sáng kiểu "Magic Bento"
 * (globals.css). Click vào thẻ còn tạo một vệt gợn sóng ngắn. Không re-render
 * React — chỉ ghi thẳng CSS custom property / thêm-xoá phần tử DOM, rAF-throttled.
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

    const onDown = (event: PointerEvent) => {
      const el = (event.target as Element | null)?.closest<HTMLElement>(".card");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const size = Math.min(Math.max(rect.width, rect.height) * 0.9, 420);
      const ripple = document.createElement("span");
      ripple.className = "card-ripple";
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      el.insertBefore(ripple, el.firstChild);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      window.setTimeout(() => ripple.remove(), 900);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
