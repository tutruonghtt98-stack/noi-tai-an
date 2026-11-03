"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { updateDepartment } from "@/actions/departments";

const COLORS = ["ochre", "jade", "mist", "rose"] as const;

export function EditDepartmentButton({
  departmentId,
  initial,
}: {
  departmentId: string;
  initial: { name: string; code: string; description: string; color: (typeof COLORS)[number]; managerEmail: string };
}) {
  const { t } = useI18n();
  const w = t.departments;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial.name);
  const [code, setCode] = useState(initial.code);
  const [description, setDescription] = useState(initial.description);
  const [color, setColor] = useState<(typeof COLORS)[number]>(initial.color);
  const [managerEmail, setManagerEmail] = useState(initial.managerEmail);

  return (
    <>
      <button type="button" className="btn btn-soft btn-sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" aria-hidden /> {w.edit}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.editDepartmentTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => updateDepartment(departmentId, { name, code: code || undefined, description: description || undefined, color, managerEmail: managerEmail || undefined }), {
              success: w.updated,
              onSuccess: () => setOpen(false),
            });
          }}
        >
          <label className="field">
            <span className="label">{w.fieldName}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoFocus />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">{w.fieldCode}</span>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
            </label>
            <label className="field">
              <span className="label">{w.fieldColor}</span>
              <div className="segmented">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor(c)} className="capitalize">
                    {c}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <label className="field">
            <span className="label">{w.fieldDescription}</span>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} />
          </label>
          <label className="field">
            <span className="label">{w.fieldManager}</span>
            <input className="input" type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder={w.fieldManagerPh} maxLength={160} />
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
