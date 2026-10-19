"use client";
import { useAction } from "@/lib/use-action";
import { adminResolveReport, adminRestorePost, adminSetBanned } from "@/actions/admin";

export function ModerationActions({ reportId, authorId, authorBanned }: { reportId: string; authorId?: string; authorBanned?: boolean }) {
  const { exec, pending } = useAction();
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => exec(() => adminResolveReport(reportId, "hide"), { success: "Đã ẩn nội dung" })}>
        Ẩn nội dung
      </button>
      <button type="button" className="btn btn-soft btn-sm bg-surface" disabled={pending} onClick={() => exec(() => adminResolveReport(reportId, "dismiss"), { success: "Đã bỏ qua" })}>
        Bỏ qua
      </button>
      {authorId && !authorBanned && (
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={pending}
          onClick={() => confirm("Khoá tài khoản người đăng?") && exec(() => adminSetBanned(authorId, true), { success: "Đã khoá tài khoản" })}
        >
          Khoá tác giả
        </button>
      )}
    </div>
  );
}

export function RestoreButton({ postId }: { postId: string }) {
  const { exec, pending } = useAction();
  return (
    <button type="button" className="btn btn-soft btn-sm bg-surface" disabled={pending} onClick={() => exec(() => adminRestorePost(postId), { success: "Đã hiện lại" })}>
      Hiện lại
    </button>
  );
}
