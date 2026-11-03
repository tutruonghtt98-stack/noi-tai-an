"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { createWorkCustomer } from "@/actions/work";

export function AddCustomerButton() {
  const { t } = useI18n();
  const c = t.work.customers;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [channel, setChannel] = useState<"ONLINE" | "IN_STORE">("ONLINE");
  const [tags, setTags] = useState("");

  const reset = () => {
    setName("");
    setEmail("");
    setCity("");
    setChannel("ONLINE");
    setTags("");
  };

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {c.addCustomer}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={c.addTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(
              () =>
                createWorkCustomer({
                  name,
                  email,
                  city: city || undefined,
                  channel,
                  tags: tags
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                }),
              {
                success: c.added,
                onSuccess: () => {
                  setOpen(false);
                  reset();
                },
              },
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
            <span className="label" id="channel-l">
              {c.addChannel}
            </span>
            <div role="radiogroup" aria-labelledby="channel-l" className="segmented mt-2 bg-surface-2">
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
