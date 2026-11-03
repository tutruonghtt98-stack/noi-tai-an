"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Làm mới dữ liệu bảng định kỳ để bảng mới/tấm thẻ được cấp quyền hiện lên gần như ngay lập tức
 * trong workspace của người/team phụ trách, không cần họ tự tải lại trang. */
export function WorkspaceLiveSync() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();
    const id = setInterval(refresh, 15_000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return null;
}
