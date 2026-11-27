"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { getCommunitySidebar } from "@/actions/community";

type SidebarData = Awaited<ReturnType<typeof getCommunitySidebar>>;

export function CommunitySidebar() {
  const { t } = useI18n();
  const [data, setData] = useState<Extract<SidebarData, { ok: true }>["data"] | null>(null);

  useEffect(() => {
    let alive = true;
    getCommunitySidebar().then((res) => {
      if (alive && res.ok) setData(res.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <aside className="grid content-start gap-[var(--gap)]">
      <section className="card" aria-labelledby="my-ch">
        <h2 id="my-ch" className="card-title mb-4 flex items-center gap-2">
          <Trophy className="size-5 text-ochre-ink" aria-hidden /> {t.community.challenge.mine}
        </h2>
        {!data ? (
          <div className="h-10 animate-pulse rounded-2xl bg-surface-2" aria-hidden />
        ) : data.challenges.length === 0 ? (
          <Link href="/community/challenges" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
            {t.community.challenge.explore} →
          </Link>
        ) : (
          <ul className="space-y-2">
            {data.challenges.map((c) => (
              <li key={c.id}>
                <Link href={`/community/challenges/${c.id}`} className="block rounded-2xl bg-surface-2 p-3 hover:bg-surface-3">
                  <span className="block truncate font-medium">{c.title}</span>
                  <span className="text-xs text-muted">{fmt(t.community.challenge.dayOf, { d: c.dayIndex, t: c.durationDays })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-labelledby="my-gr">
        <h2 id="my-gr" className="card-title mb-4 flex items-center gap-2">
          <Users className="size-5 text-jade-ink" aria-hidden /> {t.community.group.mine}
        </h2>
        {!data ? (
          <div className="h-10 animate-pulse rounded-2xl bg-surface-2" aria-hidden />
        ) : data.groups.length === 0 ? (
          <Link href="/community/groups" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
            {t.community.group.new} →
          </Link>
        ) : (
          <ul className="space-y-2">
            {data.groups.map((g) => (
              <li key={g.id}>
                <Link href={`/community/groups/${g.id}`} className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 p-3 hover:bg-surface-3">
                  <span className="truncate font-medium">{g.name}</span>
                  <span className="tabular shrink-0 text-xs text-muted">
                    {g.memberCount}/{g.maxMembers}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
