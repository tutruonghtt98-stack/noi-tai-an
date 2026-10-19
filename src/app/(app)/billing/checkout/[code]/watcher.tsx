"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, LoaderCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { cancelOrder, orderStatus, simulatePayment } from "@/actions/billing";
import { cn } from "@/lib/cn";

/** Hỏi trạng thái đơn mỗi 4 giây; khi đã thanh toán thì làm mới trang để hiện kết quả. */
export function CheckoutWatcher({ code, provider }: { code: string; provider: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { exec, pending } = useAction();

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const s = await orderStatus(code);
      if (!alive) return;
      if (s !== "PENDING") router.refresh();
    };
    const id = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [code, router]);

  return (
    <div className="mt-2 grid gap-3">
      <p className="flex items-center gap-2 text-sm text-ink-2" role="status">
        <LoaderCircle className="size-4 animate-spin" aria-hidden /> {t.billing.waiting}
      </p>
      <div className="flex flex-wrap gap-2">
        {provider === "mock" && (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => exec(() => simulatePayment(code), { onSuccess: () => router.refresh() })}>
            {t.billing.simulate}
          </button>
        )}
        <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => exec(() => cancelOrder(code), { onSuccess: () => router.refresh() })}>
          {t.billing.cancel}
        </button>
      </div>
    </div>
  );
}

export function CopyField({ label, value, copyValue, copy, strong }: { label: string; value: string; copyValue?: string; copy?: boolean; strong?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className={cn("truncate", strong ? "font-mono text-lg font-semibold" : "font-medium")}>{value}</p>
      </div>
      {copy && (
        <button
          type="button"
          className="icon-btn bg-surface"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(copyValue ?? value);
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            } catch {}
          }}
        >
          {done ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </button>
      )}
    </div>
  );
}
