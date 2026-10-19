"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, RefreshCw, LogOut, UserMinus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { createGroup, joinGroup, leaveGroup, regenerateInvite, removeMember, setCommitment } from "@/actions/groups";
import { Modal } from "@/components/ui/modal";

export function NewGroupButton() {
  const { t } = useI18n();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", description: "", maxMembers: 6 });
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {t.community.group.new}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.community.group.new}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => createGroup(f), { onSuccess: (r) => router.push(`/community/groups/${r.id}`) });
          }}
        >
          <label className="field">
            <span className="label">{t.community.group.name}</span>
            <input className="input" required minLength={2} maxLength={80} autoFocus value={f.name} placeholder={t.community.group.namePh} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">{t.community.group.description}</span>
            <textarea className="input" maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">{t.community.group.size}</span>
            <input type="number" min={3} max={10} className="input w-28" value={f.maxMembers} onChange={(e) => setF({ ...f, maxMembers: Math.min(10, Math.max(3, Number(e.target.value) || 3)) })} />
          </label>
          <p className="text-sm text-muted">{t.community.group.privacy}</p>
          <button className="btn btn-primary" disabled={pending || f.name.trim().length < 2}>
            {t.common.create}
          </button>
        </form>
      </Modal>
    </>
  );
}

export function InviteBox({ groupId, code, isOwner }: { groupId: string; code: string; isOwner: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/community/groups/join/${code}`;
  return (
    <div>
      <p className="label mb-2">{t.community.group.invite}</p>
      <div className="flex gap-2">
        <input readOnly value={url} className="input font-mono text-sm" aria-label={t.community.group.invite} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="icon-btn"
          aria-label={t.community.group.copy}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast("success", t.community.group.copied);
            } catch {}
          }}
        >
          <Copy className="size-4" aria-hidden />
        </button>
        {isOwner && (
          <button type="button" className="icon-btn" disabled={pending} aria-label={t.community.group.regenerate} title={t.community.group.regenerate} onClick={() => exec(() => regenerateInvite(groupId))}>
            <RefreshCw className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

export function CommitmentForm({ groupId, initial }: { groupId: string; initial: string }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [v, setV] = useState(initial);
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => setCommitment(groupId, v), { success: t.common.saved });
      }}
    >
      <label htmlFor="commit" className="sr-only">
        {t.community.group.commitment}
      </label>
      <input id="commit" className="input" maxLength={300} value={v} placeholder={t.community.group.commitmentPh} onChange={(e) => setV(e.target.value)} />
      <button className="btn btn-primary shrink-0" disabled={pending}>
        {t.community.group.setCommitment}
      </button>
    </form>
  );
}

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { exec, pending } = useAction();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={pending}
      onClick={() => confirm(`${t.community.group.leave}?`) && exec(() => leaveGroup(groupId), { onSuccess: () => router.push("/community/groups") })}
    >
      <LogOut className="size-4" aria-hidden /> {t.community.group.leave}
    </button>
  );
}

export function RemoveMemberButton({ groupId, memberId, name }: { groupId: string; memberId: string; name: string }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  return (
    <button
      type="button"
      className="icon-btn icon-btn-plain size-9"
      disabled={pending}
      aria-label={`${t.community.group.remove}: ${name}`}
      title={t.community.group.remove}
      onClick={() => confirm(`${t.community.group.remove}: ${name}?`) && exec(() => removeMember(groupId, memberId))}
    >
      <UserMinus className="size-4" aria-hidden />
    </button>
  );
}

export function JoinGroupButton({ code }: { code: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { exec, pending } = useAction();
  return (
    <button type="button" className="btn btn-primary" disabled={pending} onClick={() => exec(() => joinGroup(code), { onSuccess: (r) => router.push(`/community/groups/${r.id}`) })}>
      {t.community.group.join}
    </button>
  );
}
