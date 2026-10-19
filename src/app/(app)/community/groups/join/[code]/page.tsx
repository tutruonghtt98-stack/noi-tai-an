import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/format";
import { db } from "@/lib/db";
import { JoinGroupButton } from "@/components/community/group-ui";

export const metadata: Metadata = { title: "Lời mời tham gia nhóm" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const { code } = await params;
  const g = await db.group.findUnique({ where: { inviteCode: code }, include: { _count: { select: { members: true } }, members: { where: { userId: user.id } } } });
  if (!g) notFound();
  if (g.members.length) redirect(`/community/groups/${g.id}`);
  const full = g._count.members >= g.maxMembers;

  return (
    <section className="card mx-auto max-w-md text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-jade-soft text-jade-ink">
        <Users className="size-7" aria-hidden />
      </span>
      <p className="mt-4 text-sm text-muted">{t.community.group.joinTitle}</p>
      <h1 className="mt-1 text-2xl font-semibold">{g.name}</h1>
      {g.description && <p className="mt-2 text-ink-2">{g.description}</p>}
      <p className="mt-3 text-sm text-muted">{fmt(t.community.group.joinDesc, { name: g.name, n: g._count.members, max: g.maxMembers })}</p>
      <p className="mt-2 text-xs text-muted">{t.community.group.privacy}</p>
      <div className="mt-6">{full ? <p className="text-sm text-danger">{t.community.group.full}</p> : <JoinGroupButton code={code} />}</div>
    </section>
  );
}
