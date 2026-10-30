"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { createWorkProduct } from "@/actions/work";
import { PRODUCT_STATUSES, type ProductStatus } from "@/lib/work-types";

export function AddProductButton() {
  const { t } = useI18n();
  const w = t.work.products;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("0");
  const [reorderAt, setReorderAt] = useState("0");
  const [status, setStatus] = useState<ProductStatus>("ACTIVE");

  const statusLabel: Record<ProductStatus, string> = { ACTIVE: w.statusActive, DRAFT: w.statusDraft, ARCHIVED: w.statusArchived };

  const reset = () => {
    setName("");
    setSku("");
    setCategory("");
    setPrice("");
    setCost("");
    setStock("0");
    setReorderAt("0");
    setStatus("ACTIVE");
  };

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {w.addProduct}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.addTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(
              () =>
                createWorkProduct({
                  name,
                  sku,
                  category,
                  priceCents: Math.round(Number(price) || 0),
                  costCents: Math.round(Number(cost) || 0),
                  stock: Number(stock) || 0,
                  reorderAt: Number(reorderAt) || 0,
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
            <span className="label">{w.fieldName}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoFocus />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">{w.fieldSku}</span>
              <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} required maxLength={40} />
            </label>
            <label className="field">
              <span className="label">{w.fieldCategory}</span>
              <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={w.fieldCategoryPh} required maxLength={40} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">{w.fieldPrice}</span>
              <input className="input" type="number" min={0} step={1000} value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">{w.fieldCost}</span>
              <input className="input" type="number" min={0} step={1000} value={cost} onChange={(e) => setCost(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">{w.fieldStock}</span>
              <input className="input" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">{w.fieldReorderAt}</span>
              <input className="input" type="number" min={0} value={reorderAt} onChange={(e) => setReorderAt(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span className="label">{w.fieldStatus}</span>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)}>
              {PRODUCT_STATUSES.map((s) => (
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
