"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle2, PartyPopper } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { checkinChallenge, createChallenge, joinChallenge, leaveChallenge } from "@/actions/challenges";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { PeoplePicker, type Person } from "./people-picker";

const CATS = ["READING", "WORKOUT", "STUDY", "FOCUS", "GOAL", "OTHER"] as const;

export function NewChallengeButton({ canCreate, isAdmin, today, tomorrow, nextMonday, people = [] }: { canCreate: boolean; isAdmin: boolean; today: string; tomorrow: string; nextMonday: string; people?: Person[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", category: "READING" as (typeof CATS)[number], durationDays: 21 as 7 | 21 | 30, startDate: tomorrow, official: false, badgeName: "", inviteeIds: [] as string[] });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => (canCreate ? setOpen(true) : toast("error", t.community.challenge.proOnly))}>
        <Plus className="size-4" aria-hidden /> {t.community.challenge.new}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.community.challenge.new}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => createChallenge(f), {
              success: t.common.saved,
              onSuccess: (r) => {
                setOpen(false);
                router.push(`/community/challenges/${r.id}`);
              },
            });
          }}
        >
          <label className="field">
            <span className="label">{t.community.challenge.title}</span>
            <input className="input" required minLength={3} maxLength={120} value={f.title} placeholder={t.community.challenge.titlePh} onChange={(e) => set("title", e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span className="label">{t.community.challenge.description}</span>
            <textarea className="input" maxLength={2000} value={f.description} onChange={(e) => set("description", e.target.value)} />
          </label>
          <fieldset className="field">
            <legend className="label mb-1.5">{t.community.challenge.duration}</legend>
            <div className="segmented w-fit">
              {([7, 21, 30] as const).map((d) => (
                <button key={d} type="button" aria-pressed={f.durationDays === d} onClick={() => set("durationDays", d)}>
                  {d} {t.common.days}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span className="label">{t.community.challenge.start}</span>
              <select className="input" value={f.startDate} onChange={(e) => set("startDate", e.target.value)}>
                <option value={today}>{t.common.today}</option>
                <option value={tomorrow}>{t.common.tomorrow}</option>
                {nextMonday !== tomorrow && <option value={nextMonday}>{t.habits.weekdaysLong[1]} · {nextMonday}</option>}
              </select>
            </label>
            <label className="field">
              <span className="label">{t.community.challenge.category}</span>
              <select className="input" value={f.category} onChange={(e) => set("category", e.target.value as "READING")}>
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {t.community.categories[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {isAdmin && (
            <div className="grid gap-3 rounded-2xl bg-surface-2 p-4">
              <label className="flex items-center gap-3 text-sm font-medium">
                <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={f.official} onChange={(e) => set("official", e.target.checked)} />
                {t.community.challenge.official}
              </label>
              {f.official && (
                <label className="field">
                  <span className="label">{t.community.challenge.badge}</span>
                  <input className="input" maxLength={60} value={f.badgeName} onChange={(e) => set("badgeName", e.target.value)} />
                </label>
              )}
            </div>
          )}
          <fieldset className="field">
            <legend className="label mb-1">{t.challengeInvite.invite}</legend>
            <p className="mb-2 text-xs text-muted">{t.challengeInvite.inviteHint}</p>
            <PeoplePicker people={people} value={f.inviteeIds} onChange={(ids) => set("inviteeIds", ids)} />
          </fieldset>
          <p className="text-sm text-muted">{t.community.challenge.completeRule}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </button>
            <button className="btn btn-primary" disabled={pending || f.title.trim().length < 3}>
              {t.common.create}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function JoinButton({ id, joined, canLeave, ended }: { id: string; joined: boolean; canLeave?: boolean; ended?: boolean }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  if (joined) {
    return canLeave ? (
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => confirm(t.community.challenge.leave + "?") && exec(() => leaveChallenge(id))}>
        {t.community.challenge.leave}
      </button>
    ) : (
      <span className="badge bg-jade-soft text-jade-ink">{t.community.challenge.joined}</span>
    );
  }
  if (ended) return null;
  return (
    <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => exec(() => joinChallenge(id), { success: t.community.challenge.joined })}>
      {t.community.challenge.join}
    </button>
  );
}

export function CheckinPanel({ id, checkedIn, note: initialNote }: { id: string; checkedIn: boolean; note: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [note, setNote] = useState(initialNote);
  const [share, setShare] = useState(true);
  const [done, setDone] = useState(false);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => checkinChallenge(id, { note, share }), {
          onSuccess: (r) => {
            if (r.completed) setDone(true);
            else toast("success", t.community.challenge.checkedIn);
          },
        });
      }}
    >
      {done && (
        <p className="flex items-center gap-2 rounded-2xl bg-jade-soft p-4 font-semibold text-jade-ink" role="status">
          <PartyPopper className="size-5" aria-hidden /> {t.community.challenge.completed}
        </p>
      )}
      <label className="field">
        <span className="label">{t.community.challenge.checkinNote}</span>
        <textarea className="input min-h-20" maxLength={500} value={note} placeholder={t.community.challenge.checkinNotePh} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={share} onChange={(e) => setShare(e.target.checked)} />
        {t.community.challenge.shareToFeed}
      </label>
      <button className={cn("btn", checkedIn ? "btn-soft" : "btn-primary")} disabled={pending}>
        <CheckCircle2 className="size-4" aria-hidden /> {checkedIn ? t.community.challenge.checkedIn : t.community.challenge.checkin}
      </button>
    </form>
  );
}
