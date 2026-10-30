import { cn } from "@/lib/cn";

/**
 * Logo tạm thời của Nội Tại Ẩn.
 * Khi có logo chính thức: đặt file vào /public/logo.svg và thay <LogoMark /> bằng <img src="/logo.svg" />.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="10" fill="var(--ink)" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--accent)" strokeWidth="3" />
      <circle cx="16" cy="16" r="3" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-tight">
        <span className="whitespace-nowrap text-xl font-semibold tracking-tight">Nội Tại Ẩn</span>
        {subtitle && <span className="whitespace-nowrap text-xs text-muted">{subtitle}</span>}
      </span>
    </span>
  );
}
