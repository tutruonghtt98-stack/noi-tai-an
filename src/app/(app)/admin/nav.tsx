"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/users", label: "Người dùng & gói" },
  { href: "/admin/orders", label: "Giao dịch" },
  { href: "/admin/moderation", label: "Kiểm duyệt" },
  { href: "/admin/challenges", label: "Thử thách chính thức" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="segmented mb-6 max-w-full overflow-x-auto" aria-label="Admin">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={(i.href === "/admin" ? path === i.href : path.startsWith(i.href)) ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
