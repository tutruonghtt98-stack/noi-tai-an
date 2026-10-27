import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { effectivePlan } from "@/lib/plan";
import { Avatar } from "@/components/ui/avatar";
import { UserActions } from "./actions";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Quản trị · Người dùng" };
const PAGE = 25;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; plan?: string; page?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}),
    ...(sp.plan === "FREE" || sp.plan === "PRO" || sp.plan === "TEAM" ? { plan: sp.plan } : {}),
    ...(sp.plan === "BANNED" ? { bannedAt: { not: null } } : {}),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { _count: { select: { goals: true, habits: true, orders: true } } },
    }),
  ]);
  const dateFmt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeZone: admin.timezone });
  const qs = (o: Record<string, string | number | undefined>) =>
    "?" + new URLSearchParams(Object.entries({ q, plan: sp.plan, ...o }).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();

  return (
    <section className="card min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <form className="flex min-w-0 flex-1 gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            Tìm người dùng
          </label>
          <input id="q" name="q" defaultValue={q} className="input max-w-sm" placeholder="Tìm theo tên hoặc email…" />
          {sp.plan && <input type="hidden" name="plan" value={sp.plan} />}
          <button className="icon-btn bg-ink text-bg hover:bg-ink hover:text-bg" aria-label="Tìm">
            <Search className="size-4" aria-hidden />
          </button>
        </form>
        <nav className="segmented max-w-full overflow-x-auto" aria-label="Lọc theo gói">
          {[undefined, "FREE", "PRO", "TEAM", "BANNED"].map((p) => (
            <Link key={p ?? "all"} href={qs({ plan: p, page: undefined })} aria-current={sp.plan === p ? "page" : undefined}>
              {p ?? "Tất cả"}
            </Link>
          ))}
        </nav>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-ink-2">
            <tr className="border-b border-line">
              <th className="py-3 pr-4 font-medium">Người dùng</th>
              <th className="py-3 pr-4 font-medium">Gói</th>
              <th className="py-3 pr-4 font-medium">Hết hạn</th>
              <th className="py-3 pr-4 font-medium">Dữ liệu</th>
              <th className="py-3 pr-4 font-medium">Tham gia</th>
              <th className="py-3 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const eff = effectivePlan(u);
              return (
                <tr key={u.id} className={cn("border-b border-line last:border-0", u.bannedAt && "opacity-60")}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name ?? u.email ?? "?"} image={u.image} size={36} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.name ?? "—"} {u.role === "ADMIN" && <span className="badge ml-1 bg-mist-soft text-mist-ink">ADMIN</span>}
                          {u.bannedAt && <span className="badge ml-1 bg-rose-soft text-rose-ink">Đã khoá</span>}
                        </p>
                        <p className="truncate text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={cn("badge", eff !== "FREE" && "bg-accent-soft text-accent-ink")}>{eff}</span>
                    {eff !== u.plan && <span className="ml-1 text-xs text-muted">({u.plan} hết hạn)</span>}
                  </td>
                  <td className="py-3 pr-4">{u.planExpiresAt ? dateFmt.format(u.planExpiresAt) : "—"}</td>
                  <td className="py-3 pr-4 text-muted">
                    {u._count.goals} mục tiêu · {u._count.habits} thói quen · {u._count.orders} đơn
                  </td>
                  <td className="py-3 pr-4">{dateFmt.format(u.createdAt)}</td>
                  <td className="py-3 text-right">
                    <UserActions id={u.id} self={u.id === admin.id} banned={!!u.bannedAt} role={u.role} plan={u.plan} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>
          {total} người dùng · trang {page}/{Math.max(1, Math.ceil(total / PAGE))}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link className="btn btn-soft btn-sm" href={qs({ page: page - 1 })}>
              ← Trước
            </Link>
          )}
          {page * PAGE < total && (
            <Link className="btn btn-soft btn-sm" href={qs({ page: page + 1 })}>
              Sau →
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
