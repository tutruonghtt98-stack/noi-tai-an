import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { business } from "@/lib/business";

export async function SiteFooter() {
  const { t } = await getI18n();
  const links = [
    ["/pricing", t.legal.pricing],
    ["/terms", t.legal.terms],
    ["/privacy", t.legal.privacy],
    ["/refund", t.legal.refund],
    ["/contact", t.legal.contact],
  ] as const;
  return (
    <footer className="mt-10 border-t border-line py-8 text-sm text-muted">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-ink-2">
            © {new Date().getFullYear()} {business.brand}
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
