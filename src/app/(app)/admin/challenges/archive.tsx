"use client";
import { useAction } from "@/lib/use-action";
import { archiveChallenge } from "@/actions/challenges";

export function ArchiveChallengeButton({ id }: { id: string }) {
  const { exec, pending } = useAction();
  return (
    <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => confirm("Lưu trữ (ẩn) thử thách này?") && exec(() => archiveChallenge(id), { success: "Đã lưu trữ" })}>
      Lưu trữ
    </button>
  );
}
