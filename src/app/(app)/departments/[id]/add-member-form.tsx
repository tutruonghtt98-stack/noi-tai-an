"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Modal } from "@/components/ui/modal";
import { addDepartmentMember } from "@/actions/departments";

type Role = "MANAGER" | "MEMBER" | "VIEWER";

export function AddMemberButton({ departmentId }: { departmentId: string }) {
  const { t } = useI18n();
  const w = t.departments;
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");

  const roleLabel: Record<Role, string> = { MANAGER: w.roleManager, MEMBER: w.roleMember, VIEWER: w.roleViewer };

  return (
    <>
      <button type="button" className="btn btn-soft btn-sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {w.addMember}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={w.addMemberTitle}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => addDepartmentMember(departmentId, email, role), {
              success: w.memberAdded,
              onSuccess: () => {
                setOpen(false);
                setEmail("");
                setRole("MEMBER");
              },
            });
          }}
        >
          <label className="field">
            <span className="label">{w.fieldEmail}</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={w.fieldEmailPh} required maxLength={160} autoFocus />
            <span className="mt-1 block text-xs text-muted">{w.inviteHint}</span>
          </label>
          <label className="field">
            <span className="label">{w.fieldRole}</span>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(["MANAGER", "MEMBER", "VIEWER"] as Role[]).map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
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
