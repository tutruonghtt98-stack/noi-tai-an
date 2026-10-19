"use client";
import { useAction } from "@/lib/use-action";
import { adminCancelOrder, adminMarkPaid } from "@/actions/admin";

export function OrderActions({ id, code }: { id: string; code: string }) {
  const { exec, pending } = useAction();
  return (
    <div className="flex justify-end gap-1.5">
      <button
        type="button"
        className="btn btn-soft btn-sm"
        disabled={pending}
        onClick={() => {
          const note = prompt(`Xác nhận đã nhận tiền cho đơn ${code}? Ghi chú đối soát (mã GD ngân hàng):`);
          if (note !== null) exec(() => adminMarkPaid(id, note), { success: "Đã kích hoạt gói" });
        }}
      >
        Đánh dấu đã thu
      </button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => confirm(`Huỷ đơn ${code}?`) && exec(() => adminCancelOrder(id))}>
        Huỷ
      </button>
    </div>
  );
}
