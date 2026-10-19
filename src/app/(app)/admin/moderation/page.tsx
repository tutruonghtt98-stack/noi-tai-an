/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { ModerationActions, RestoreButton } from "./actions";

export const metadata: Metadata = { title: "Quản trị · Kiểm duyệt" };

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requireAdmin();
  const tab = (await searchParams).tab === "hidden" ? "hidden" : "open";
  const fmt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: admin.timezone });

  const tabs = (
    <nav className="segmented mb-5" aria-label="Kiểm duyệt">
      <Link href="/admin/moderation" aria-current={tab === "open" ? "page" : undefined}>
        Báo cáo chờ xử lý
      </Link>
      <Link href="/admin/moderation?tab=hidden" aria-current={tab === "hidden" ? "page" : undefined}>
        Đã ẩn
      </Link>
    </nav>
  );

  if (tab === "hidden") {
    const hidden = await db.post.findMany({ where: { hiddenAt: { not: null } }, orderBy: { hiddenAt: "desc" }, take: 50, include: { user: { select: { name: true, email: true } } } });
    return (
      <section className="card">
        {tabs}
        <ul className="space-y-3">
          {hidden.map((p) => (
            <li key={p.id} className="flex items-start gap-3 rounded-2xl bg-surface-2 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">
                  {p.user.name} · {p.user.email} · ẩn lúc {fmt.format(p.hiddenAt!)}
                </p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{p.content}</p>
              </div>
              <RestoreButton postId={p.id} />
            </li>
          ))}
          {hidden.length === 0 && <p className="py-8 text-center text-sm text-muted">Không có nội dung bị ẩn.</p>}
        </ul>
      </section>
    );
  }

  const reports = await db.report.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, take: 50, include: { reporter: { select: { name: true } } } });
  const [posts, comments] = await Promise.all([
    db.post.findMany({ where: { id: { in: reports.flatMap((r) => (r.postId ? [r.postId] : [])) } }, include: { user: { select: { id: true, name: true, email: true, bannedAt: true } } } }),
    db.comment.findMany({ where: { id: { in: reports.flatMap((r) => (r.commentId ? [r.commentId] : [])) } }, include: { user: { select: { id: true, name: true, email: true, bannedAt: true } } } }),
  ]);

  return (
    <section className="card">
      {tabs}
      <p className="mb-4 text-sm text-muted">{reports.length} báo cáo đang chờ. Xử lý theo thứ tự cũ nhất trước.</p>
      <ul className="space-y-3">
        {reports.map((r) => {
          const target = r.postId ? posts.find((p) => p.id === r.postId) : comments.find((c) => c.id === r.commentId);
          return (
            <li key={r.id} className="rounded-2xl bg-surface-2 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="badge bg-rose-soft text-rose-ink">{r.reason}</span>
                <span className="text-muted">
                  {r.postId ? "Bài viết" : "Bình luận"} · báo cáo bởi {r.reporter.name} · {fmt.format(r.createdAt)}
                </span>
              </div>
              {target ? (
                <>
                  <p className="mt-2 text-sm font-medium">
                    {target.user.name} <span className="font-normal text-muted">({target.user.email})</span>
                    {target.user.bannedAt && <span className="badge ml-2">Đã khoá</span>}
                  </p>
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap">{target.content}</p>
                  {"imageUrl" in target && target.imageUrl && <img src={target.imageUrl} alt="" className="mt-2 max-h-48 rounded-xl" />}
                  <ModerationActions reportId={r.id} authorId={target.user.id} authorBanned={!!target.user.bannedAt} />
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted">Nội dung đã bị xoá.</p>
                  <ModerationActions reportId={r.id} />
                </>
              )}
            </li>
          );
        })}
        {reports.length === 0 && <p className="py-8 text-center text-sm text-muted">Không có báo cáo nào.</p>}
      </ul>
    </section>
  );
}
