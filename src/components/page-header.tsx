import { SplitHeading } from "@/components/ui/split-heading";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div className="max-w-2xl">
        <SplitHeading text={title} className="text-3xl font-semibold sm:text-[2.5rem]" />
        {subtitle && <p className="mt-2 text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
