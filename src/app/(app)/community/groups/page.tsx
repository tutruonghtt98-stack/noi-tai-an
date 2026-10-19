import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { db } from "@/lib/db";
import { Empty } from "@/components/ui/empty";
import { Avatar } from "@/components/ui/avatar";
import { NewGroupButton } from "@/components/community/group-ui";

export const metadata: Metadata = { title: "Nhóm đồng hành" };

export default async function GroupsPage() {
  const user = await requireUser();
  const { t } = await getI18n();
  const groups = await db.group.findMany({
    where: { members: { some: { userId: user.id } } },
    include: { members: { include: { user: { select: { name: true, image: true } } }, orderBy: { joinedAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">
          {t.community.group.privacy} {t.community.group.limit}
        </p>
        <NewGroupButton />
      </div>
      {groups.length === 0 ? (
        <div className="card">
          <Empty icon={Users} text={t.community.group.empty} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <Link key={g.id} href={`/community/groups/${g.id}`} className="card rise flex flex-col gap-3 transition-shadow hover:shadow-pop">
              <h2 className="text-lg font-semibold">{g.name}</h2>
              {g.description && <p className="line-clamp-2 text-sm text-ink-2">{g.description}</p>}
              <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                <div className="flex -space-x-2">
                  {g.members.slice(0, 6).map((m) => (
                    <Avatar key={m.userId} name={m.user.name ?? "?"} image={m.user.image} size={32} />
                  ))}
                </div>
                <span className="tabular text-sm text-muted">
                  {g.members.length}/{g.maxMembers}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
