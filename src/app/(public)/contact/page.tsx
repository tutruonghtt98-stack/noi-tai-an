import type { Metadata } from "next";
import { Mail, Phone, MapPin, Building2 } from "lucide-react";
import { business } from "@/lib/business";

export const metadata: Metadata = { title: "Liên hệ" };

export default function ContactPage() {
  const rows = [
    { icon: Building2, label: "Đơn vị vận hành", value: `${business.legalName} · MST ${business.taxId}` },
    { icon: MapPin, label: "Địa chỉ", value: business.address },
    { icon: Mail, label: "Email hỗ trợ", value: business.email, href: `mailto:${business.email}` },
    { icon: Phone, label: "Điện thoại", value: business.phone },
  ];
  return (
    <section className="card mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold sm:text-4xl">Liên hệ</h1>
      <p className="mt-2 text-ink-2">Chúng tôi phản hồi trong vòng 1–2 ngày làm việc (T2–T6, 9:00–18:00).</p>
      <ul className="mt-8 space-y-3">
        {rows.map(({ icon: Icon, label, value, href }) => (
          <li key={label} className="flex items-start gap-4 rounded-2xl bg-surface-2 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink-2">
              <Icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm text-muted">{label}</span>
              {href ? (
                <a href={href} className="font-medium underline-offset-4 hover:underline">
                  {value}
                </a>
              ) : (
                <span className="font-medium">{value}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
