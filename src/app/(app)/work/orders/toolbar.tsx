"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { OrderChannelFilter, OrderStatus } from "@/lib/work-types";

function buildHref(status: OrderStatus | "all", channel: OrderChannelFilter, q: string, sort: "recent" | "total") {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (channel !== "all") params.set("channel", channel);
  if (sort !== "recent") params.set("sort", sort);
  const qs = params.toString();
  return `/work/orders${qs ? `?${qs}` : ""}`;
}

export function OrderToolbar({
  search,
  status,
  channel,
  sort,
  searchPh,
}: {
  search: string;
  status: OrderStatus | "all";
  channel: OrderChannelFilter;
  sort: "recent" | "total";
  searchPh: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setQ(search), [search]);

  const onSearch = (value: string) => {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.push(buildHref(status, channel, value, sort)), 350);
  };

  return (
    <label className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input className="input w-64 pl-9" placeholder={searchPh} value={q} onChange={(e) => onSearch(e.target.value)} maxLength={80} />
    </label>
  );
}
