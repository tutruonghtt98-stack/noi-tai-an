"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { WorkFilter, WorkSort } from "@/lib/work-queries";

function buildHref(filter: WorkFilter, q: string, sort: WorkSort) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filter !== "all") params.set("filter", filter);
  if (sort !== "spend") params.set("sort", sort);
  const qs = params.toString();
  return `/work/customers${qs ? `?${qs}` : ""}`;
}

export function CustomerToolbar({
  search,
  sort,
  filter,
  labels,
}: {
  search: string;
  sort: WorkSort;
  filter: WorkFilter;
  labels: { searchPh: string; spend: string; orders: string; recent: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setQ(search), [search]);

  const onSearch = (value: string) => {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.push(buildHref(filter, value, sort)), 350);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input className="input w-56 pl-9" placeholder={labels.searchPh} value={q} onChange={(e) => onSearch(e.target.value)} maxLength={80} />
      </label>
      <select className="input w-auto" value={sort} onChange={(e) => router.push(buildHref(filter, q, e.target.value as WorkSort))}>
        <option value="spend">{labels.spend}</option>
        <option value="orders">{labels.orders}</option>
        <option value="recent">{labels.recent}</option>
      </select>
    </div>
  );
}
