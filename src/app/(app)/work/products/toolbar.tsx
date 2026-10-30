"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { ProductStatus } from "@/lib/work-types";

function buildHref(category: string, status: ProductStatus | "all", q: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category !== "all") params.set("category", category);
  if (status !== "all") params.set("status", status);
  const qs = params.toString();
  return `/work/products${qs ? `?${qs}` : ""}`;
}

export function ProductToolbar({
  search,
  category,
  status,
  searchPh,
}: {
  search: string;
  category: string;
  status: ProductStatus | "all";
  searchPh: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setQ(search), [search]);

  const onSearch = (value: string) => {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.push(buildHref(category, status, value)), 350);
  };

  return (
    <label className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input className="input w-64 pl-9" placeholder={searchPh} value={q} onChange={(e) => onSearch(e.target.value)} maxLength={80} />
    </label>
  );
}
