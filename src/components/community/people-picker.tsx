"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { useAction } from "@/lib/use-action";
import { inviteToChallenge, respondInvite } from "@/actions/challenges";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export type Person = { id: string; name: string; image: string | null };

/** Danh sách chọn nhiều người (có ô tìm kiếm). */
export function PeoplePicker({ people, value, onChange, disabledIds = [] }: { people: Person[]; value: string[]; onChange: (ids: string[]) => void; disabledIds?: string[] }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  if (!people.length) return <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">{t.challengeInvite.noPeople}</p>;
  const shown = people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="grid gap-2">
      {people.length > 6 && <input className="input" placeholder={t.challengeInvite.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t.challengeInvite.search} />}
      <ul className="max-h-60 space-y-1 overflow-y-auto rounded-2xl bg-surface-2 p-1.5">
        {shown.map((p) => {
          const disabled = disabledIds.includes(p.id);
          const on = value.includes(p.id) || disabled;
          return (
            <li key={p.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={disabled}
                onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}
                className={cn("flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 text-left transition-colors disabled:cursor-default disabled:opacity-50", on ? "bg-surface" : "hover:bg-surface/60")}
              >
                <Avatar name={p.name} image={p.image} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                <span className={cn("grid size-6 place-items-center rounded-full border-2", on ? "border-ink bg-ink text-bg" : "border-surface-3")}>
                  {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {value.length > 0 && <p className="text-xs text-muted">{fmt(t.challengeInvite.selected, { n: value.length })}</p>}
    </div>
  );
}

export function InviteMoreButton({ challengeId, people, memberIds }: { challengeId: string; people: Person[]; memberIds: string[] }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  return (
    <>
      <button type="button" className="btn btn-soft btn-sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden /> {t.challengeInvite.inviteMore}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.challengeInvite.invite}>
        <p className="mb-3 text-sm text-ink-2">{t.challengeInvite.inviteHint}</p>
        <PeoplePicker people={people} value={ids} onChange={setIds} disabledIds={memberIds} />
        <button
          type="button"
          className="btn btn-primary mt-4 w-full"
          disabled={pending || !ids.length}
          onClick={() =>
            exec(() => inviteToChallenge(challengeId, ids), {
              onSuccess: (r) => {
                setOpen(false);
                setIds([]);
                void r;
              },
              success: fmt(t.challengeInvite.sent, { n: ids.length }),
            })
          }
        >
          {t.challengeInvite.invite}
        </button>
      </Modal>
    </>
  );
}

export function InviteCard({ id, inviter, title, days }: { id: string; inviter: Person; title: string; days: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
      <Avatar name={inviter.name} image={inviter.image} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{fmt(t.challengeInvite.from, { n: inviter.name })}</p>
        <p className="truncate font-semibold">
          {title} <span className="font-normal text-muted">· {fmt(t.community.challenge.days, { n: days })}</span>
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => exec(() => respondInvite(id, false), { success: t.challengeInvite.declined, onSuccess: () => setGone(true) })}>
          {t.challengeInvite.decline}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={pending}
          onClick={() => exec(() => respondInvite(id, true), { success: t.challengeInvite.accepted, onSuccess: (r) => router.push(`/community/challenges/${r.challengeId}`) })}
        >
          {t.challengeInvite.accept}
        </button>
      </div>
    </li>
  );
}
