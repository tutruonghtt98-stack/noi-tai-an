import type { LucideIcon } from "lucide-react";
import { fmt } from "@/lib/i18n/format";
import type { Dict } from "@/lib/i18n/vi";

export function ComingSoon({ icon: Icon, title, text, phase, t }: { icon: LucideIcon; title: string; text: string; phase: number; t: Dict }) {
  return (
    <section className="card hero-glow grid min-h-[60vh] place-items-center text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent-ink">
          <Icon className="size-8" aria-hidden />
        </span>
        <span className="badge mt-6">{t.common.comingSoon}</span>
        <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-ink-2">{text}</p>
        <p className="mt-2 text-sm text-muted">{fmt(t.soon.phase, { n: phase })}</p>
      </div>
    </section>
  );
}
