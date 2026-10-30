"use client";
import { Trash2 } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { useI18n } from "@/lib/i18n/client";
import { deleteWorkCustomer } from "@/actions/work";

export function DeleteCustomerButton({ id, label, confirm }: { id: string; label: string; confirm: string }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();

  return (
    <button
      type="button"
      className="icon-btn icon-btn-plain opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-40"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirm)) return;
        exec(() => deleteWorkCustomer(id), { success: t.work.customers.deleted });
      }}
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}
