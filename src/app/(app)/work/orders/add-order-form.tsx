"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { createWorkOrder } from "@/actions/work";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/work-types";

export function AddOrderButton() {
  const { t } = useI18n();
  const w = t.work.orders;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [city, setCity] = useState("");
  const [channel, setChannel] = useState<"ONLINE" | "IN_STORE">("ONLINE");
  const [items, setItems] = useState("1");
  const [total, setTotal] = useState("");
  const [payment, setPayment] = useState("");
  const [status, setStatus] = useState<OrderStatus>("PENDING");

  const statusLabel: Record<OrderStatus, string> = {
    PENDING: w.statusPending,
    PAID: w.statusPaid,
    PACKED: w.statusPacked,
    SHIPPED: w.statusShipped,
    DELIVERED: w.statusDelivered,
    CLOSED: w.statusClosed,
  };

  const reset = () => {
    setCustomerName("");
    setCity("");
    setChannel("ONLINE");
    setItems("1");
    setTotal("");
    setPayment("");
    setStatus("PENDING");
  };

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {w.addOrder}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.addTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(
              () =>
                createWorkOrder({
                  customerName,
                  customerCity: city || undefined,
                  channel,
                  items: Number(items) || 1,
                  totalCents: Math.round(Number(total) || 0),
                  payment,
                  status,
                }),
              {
                success: w.added,
                onSuccess: () => {
                  setOpen(false);
                  reset();
                },
              },
            );
          }}
        >
          <label className="field">
            <span className="label">{w.fieldCustomerName}</span>
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required maxLength={120} autoFocus />
          </label>
          <label className="field">
            <span className="label">{w.fieldCity}</span>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
          </label>
          <div>
            <span className="label" id="order-channel-l">
              {w.fieldChannel}
            </span>
            <div role="radiogroup" aria-labelledby="order-channel-l" className="segmented mt-2">
              <button type="button" aria-pressed={channel === "ONLINE"} onClick={() => setChannel("ONLINE")}>
                {w.channelOnline}
              </button>
              <button type="button" aria-pressed={channel === "IN_STORE"} onClick={() => setChannel("IN_STORE")}>
                {w.channelInStore}
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">{w.fieldItems}</span>
              <input className="input" type="number" min={1} max={999} value={items} onChange={(e) => setItems(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">{w.fieldTotal}</span>
              <input className="input" type="number" min={0} step={1000} value={total} onChange={(e) => setTotal(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span className="label">{w.fieldPayment}</span>
            <input className="input" value={payment} onChange={(e) => setPayment(e.target.value)} placeholder={w.fieldPaymentPh} required maxLength={40} />
          </label>
          <label className="field">
            <span className="label">{w.fieldStatus}</span>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={pending}>
              {w.save}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
