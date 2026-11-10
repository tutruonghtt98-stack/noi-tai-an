"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { updateWorkCustomer } from "@/actions/work";

type Customer = { id: string; name: string; email: string; city: string | null; channel: string; tags: string[] };

export function EditCustomerButton({ customer }: { customer: Customer }) {
  const { t } = useI18n();
  const c = t.work.customers;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  const [city, setCity] = useState(customer.city ?? "");
  const [channel, setChannel] = useState<"ONLINE" | "IN_STORE">(customer.channel === "IN_STORE" ? "IN_STORE" : "ONLINE");
  const [tags, setTags] = useState(customer.tags.join(", "));

  const openEdit = () => {
    setName(customer.name);
    setEmail(customer.email);
    setCity(customer.city ?? "");
    setChannel(customer.channel === "IN_STORE" ? "IN_STORE" : "ONLINE");
    setTags(customer.tags.join(", "));
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="icon-btn icon-btn-plain opacity-0 transition-opacity group-hover:opacity-100"
        aria-label={c.edit}
        title={c.edit}
        onClick={openEdit}
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={c.editTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(
              () =>
                updateWorkCustomer(customer.id, {
                  name,
                  email,
                  city: city || undefined,
                  channel,
                  tags: tags
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                }),
              { success: c.updated, onSuccess: () => setOpen(false) },
            );
          }}
        >
          <label className="field">
            <span className="label">{c.addName}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoFocus />
          </label>
          <label className="field">
            <span className="label">{c.addEmail}</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={160} />
          </label>
          <label className="field">
            <span className="label">{c.addCity}</span>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
          </label>
          <div>
            <span className="label" id="edit-channel-l">
              {c.addChannel}
            </span>
            <div role="radiogroup" aria-labelledby="edit-channel-l" className="segmented mt-2 bg-surface-2">
              <button type="button" aria-pressed={channel === "ONLINE"} onClick={() => setChannel("ONLINE")}>
                {c.channelOnline}
              </button>
              <button type="button" aria-pressed={channel === "IN_STORE"} onClick={() => setChannel("IN_STORE")}>
                {c.channelInStore}
              </button>
            </div>
          </div>
          <label className="field">
            <span className="label">{c.addTags}</span>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={c.addTagsPh} maxLength={120} />
          </label>
          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={pending}>
              {c.addSave}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
