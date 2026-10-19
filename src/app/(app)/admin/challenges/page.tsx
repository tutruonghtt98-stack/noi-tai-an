import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { addDays, dayOfWeek, fromDbDate, todayISO } from "@/lib/dates";
import { challengeWindow } from "@/lib/challenges";
import { NewChallengeButton } from "@/components/community/challenge-ui";
import { ArchiveChallengeButton } from "./archive";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Quản trị · Thử thách" };

export default async function AdminChallenges() {
  const admin = await requireAdmin();
  const today = todayISO(admin.timezone);
  const list = await db.challenge.findMany({
    where: { archivedAt: null },
    orderBy: [{ official: "desc" }, { startDate: "desc" }],
    take: 100,
    include: { creator: { select: { name: true } }, _count: { select: { members: true, checkins: true } } },
  });
  const nextMonday = addDays(today, ((8 - dayOfWeek(today)) % 7) || 7);
  const label = { upcoming: "Sắp diễn ra", active: "Đang diễn ra", ended: "Đã kết thúc" };

  return (
    <section className="card min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">
          Thử thách chính thức được ghim đầu danh sách, có viền nổi bật và trao huy hiệu riêng khi người tham gia hoàn thành (≥ 80% số ngày).
        </p>
        <NewChallengeButton canCreate isAdmin today={today} tomorrow={addDays(today, 1)} nextMonday={nextMonday} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-ink-2">
            <tr className="border-b border-line">
              <th className="py-3 pr-4 font-medium">Thử thách</th>
              <th className="py-3 pr-4 font-medium">Bắt đầu</th>
              <th className="py-3 pr-4 font-medium">Trạng thái</th>
              <th className="py-3 pr-4 text-right font-medium">Tham gia</th>
              <th className="py-3 pr-4 text-right font-medium">Check-in</th>
              <th className="py-3 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const w = challengeWindow(c, today);
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4">
                    <Link href={`/community/challenges/${c.id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                    <span className="ml-2 text-xs text-muted">
                      {c.durationDays} ngày · {c.creator.name}
                    </span>
                    {c.official && <span className="badge ml-2 bg-ochre-soft text-ochre-ink">Chính thức{c.badgeName ? ` · ${c.badgeName}` : ""}</span>}
                  </td>
                  <td className="py-3 pr-4">{fromDbDate(c.startDate)}</td>
                  <td className="py-3 pr-4">
                    <span className={cn("badge", w.state === "active" && "bg-jade-soft text-jade-ink")}>{label[w.state]}</span>
                  </td>
                  <td className="tabular py-3 pr-4 text-right">{c._count.members}</td>
                  <td className="tabular py-3 pr-4 text-right">{c._count.checkins}</td>
                  <td className="py-3 text-right">
                    <ArchiveChallengeButton id={c.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-8 text-center text-sm text-muted">Chưa có thử thách.</p>}
      </div>
    </section>
  );
}
