"use client";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { adminSetBanned, adminSetPlan, adminSetRole } from "@/actions/admin";
import { Modal } from "@/components/ui/modal";

export function UserActions({ id, self, banned, role, plan }: { id: string; self: boolean; banned: boolean; role: string; plan: string }) {
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [p, setP] = useState<"FREE" | "PRO" | "TEAM">(plan === "FREE" ? "PRO" : (plan as "PRO"));
  const [months, setMonths] = useState(1);

  return (
    <>
      <button type="button" className="icon-btn icon-btn-plain" aria-label="Thao tác" onClick={() => setOpen(true)}>
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Quản lý người dùng">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => adminSetPlan(id, p, p === "FREE" ? 0 : months), { success: "Đã cập nhật gói", onSuccess: () => setOpen(false) });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span className="label">Gói</span>
              <select className="input" value={p} onChange={(e) => setP(e.target.value as "PRO")}>
                <option value="FREE">FREE</option>
                <option value="PRO">PRO</option>
                <option value="TEAM">TEAM</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Số tháng (tính từ hôm nay)</span>
              <input type="number" min={1} max={60} className="input" disabled={p === "FREE"} value={months} onChange={(e) => setMonths(Number(e.target.value) || 1)} />
            </label>
          </div>
          <button className="btn btn-primary" disabled={pending}>
            Lưu gói
          </button>
        </form>
        {!self && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
            <button
              type="button"
              className="btn btn-soft btn-sm"
              disabled={pending}
              onClick={() => exec(() => adminSetRole(id, role === "ADMIN" ? "USER" : "ADMIN"), { success: "Đã đổi quyền", onSuccess: () => setOpen(false) })}
            >
              {role === "ADMIN" ? "Gỡ quyền ADMIN" : "Cấp quyền ADMIN"}
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={pending}
              onClick={() =>
                (banned || confirm("Khoá tài khoản này? Người dùng sẽ không đăng nhập được.")) &&
                exec(() => adminSetBanned(id, !banned), { success: banned ? "Đã mở khoá" : "Đã khoá tài khoản", onSuccess: () => setOpen(false) })
              }
            >
              {banned ? "Mở khoá tài khoản" : "Khoá tài khoản"}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
