import { business } from "@/lib/business";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="card mx-auto max-w-3xl">
      <p className="text-sm text-muted">Cập nhật lần cuối: {business.updated}</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{title}</h1>
      <div className="legal mt-8 space-y-6 leading-relaxed text-ink-2 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5 [&_a]:underline [&_a]:underline-offset-4 [&_strong]:text-ink">
        {children}
      </div>
    </article>
  );
}
