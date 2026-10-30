"use client";
import { Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { deleteWorkProduct, updateWorkProductStatus } from "@/actions/work";
import { PRODUCT_STATUSES, type ProductStatus } from "@/lib/work-types";

export function ProductCardControls({
  productId,
  status,
  statusLabel,
  deleteLabel,
  confirmDelete,
}: {
  productId: string;
  status: string;
  statusLabel: Record<ProductStatus, string>;
  deleteLabel: string;
  confirmDelete: string;
}) {
  const { t } = useI18n();
  const { exec, pending } = useAction();

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label={t.work.products.fieldStatus}
        className="h-7 rounded-full border-0 bg-surface-2 px-2 text-xs text-ink-2"
        value={status}
        disabled={pending}
        onChange={(e) => e.target.value !== status && exec(() => updateWorkProductStatus(productId, e.target.value), { success: t.work.products.statusUpdated })}
      >
        {PRODUCT_STATUSES.map((s) => (
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
          exec(() => deleteWorkProduct(productId), { success: t.work.products.deleted });
        }}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
