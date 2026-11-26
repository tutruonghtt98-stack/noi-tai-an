import Link from "next/link";
import { dictionaries } from "@/lib/i18n";
import { business } from "@/lib/business";

async function currentYear() {
  "use cache";
  return new Date().getFullYear();
}

// Luôn hiển thị nhãn tiếng Việt — footer được dùng trong khung layout tĩnh
// (public), nơi không đọc cookie/session để có thể prerender tĩnh thật.
export async function SiteFooter() {
  const year = await currentYear();
  const t = dictionaries.vi.legal;
  const links = [
    ["/pricing", t.pricing],
    ["/terms", t.terms],
    ["/privacy", t.privacy],
    ["/refund", t.refund],
    ["/contact", t.contact],
  ] as const;
  return (
    <footer className="mt-10 border-t border-line py-8 text-sm text-muted">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-ink-2">
            © {year} {business.brand}
          </p>
          <p>{business.legalName} · MST: {business.taxId}</p>
          <p>{business.address}</p>
          <p>
            {business.email} · {business.phone}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="underline-offset-4 hover:text-ink hover:underline">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
