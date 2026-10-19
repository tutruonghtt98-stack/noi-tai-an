"use client";
import { useEffect, useState } from "react";
import { Pause, Play, ChevronRight, Quote } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

const INTERVAL = 10_000;

/** Câu nói truyền động lực của người nổi tiếng — đổi mỗi 10 giây, dừng khi rê chuột/nhấn tạm dừng. */
export function QuoteRotator() {
  const { t, locale } = useI18n();
  const quotes = t.quotes;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(true);

  // Bắt đầu từ một câu ngẫu nhiên sau khi tải (tránh lệch hydrate)
  useEffect(() => setI(Math.floor(Math.random() * quotes.length)), [quotes.length]);

  const go = (next: number) => {
    setVisible(false);
    setTimeout(() => {
      setI(((next % quotes.length) + quotes.length) % quotes.length);
      setVisible(true);
    }, 250);
  };

  useEffect(() => {
    if (paused || hover) return;
    const id = setInterval(() => go(i + 1), INTERVAL);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, paused, hover]);

  const [text, author] = quotes[i] ?? quotes[0]!;
  return (
    <figure className="group relative mt-3" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-roledescription={locale === "en" ? "quote" : "câu nói"}>
      <Quote className="absolute -left-1 -top-1 size-5 text-accent opacity-60" aria-hidden />
      <div className="min-h-[4.75rem] pl-6 transition-opacity duration-300 motion-reduce:transition-none" style={{ opacity: visible ? 1 : 0 }} aria-live="off">
        <blockquote className="text-[0.9375rem] italic leading-relaxed text-ink-2">“{text}”</blockquote>
        <figcaption className="mt-1 text-sm font-medium text-muted">— {author}</figcaption>
      </div>
      <div className="mt-1 flex items-center gap-1 pl-5">
        <button type="button" className="icon-btn icon-btn-plain size-8" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"} aria-pressed={paused}>
          {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
        </button>
        <button type="button" className="icon-btn icon-btn-plain size-8" onClick={() => go(i + 1)} aria-label={locale === "en" ? "Next quote" : "Câu tiếp theo"}>
          <ChevronRight className="size-4" aria-hidden />
        </button>
        <span className="flex gap-1" aria-hidden>
          {quotes.map((_, k) => (
            <span key={k} className="size-1.5 rounded-full transition-colors" style={{ background: k === i ? "var(--ink)" : "var(--surface-3)" }} />
          ))}
        </span>
      </div>
    </figure>
  );
}
