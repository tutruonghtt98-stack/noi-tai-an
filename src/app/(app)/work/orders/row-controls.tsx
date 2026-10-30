"use client";
import { Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { deleteWorkOrder, updateWorkOrderStatus } from "@/actions/work";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/work-types";

export function OrderRowControls({
  orderId,
  status,
  statusLabel,
  deleteLabel,
  confirmDelete,
}: {
  orderId: string;
  status: string;
  statusLabel: Record<OrderStatus, string>;
  deleteLabel: string;
  confirmDelete: string;
}) {
  const { t } = useI18n();
  const { exec, pending } = useAction();

  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <select
        aria-label={t.work.orders.fieldStatus}
        className="h-7 rounded-full border-0 bg-surface-2 px-2 text-xs text-ink-2"
        value={status}
        disabled={pending}
        onChange={(e) => e.target.value !== status && exec(() => updateWorkOrderStatus(orderId, e.target.value), { success: t.work.orders.statusUpdated })}
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabel[s]}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="icon-btn icon-btn-plain size-7"
        aria-label={deleteLabel}
        title={deleteLabel}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmDelete)) return;
          exec(() => deleteWorkOrder(orderId), { success: t.work.orders.deleted });
        }}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
