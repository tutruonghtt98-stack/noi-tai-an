"use client";
import { useState } from "react";
import { Check, LocateFixed, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { reviewJoinRequest, updateGroupSettings } from "@/actions/groups";
import { Avatar } from "@/components/ui/avatar";

const CATS = ["READING", "WORKOUT", "STUDY", "FOCUS", "GOAL", "OTHER"] as const;
type Cat = (typeof CATS)[number];

export function GroupSettingsForm({
  groupId,
  initial,
}: {
  groupId: string;
  initial: { isPublic: boolean; category: Cat | null; city: string; description: string; lat: number | null; lng: number | null };
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { exec, pending } = useAction();
  const [f, setF] = useState(initial);
  const [locating, setLocating] = useState(false);
  const s = t.groupSettings;

  const locate = () => {
    if (!("geolocation" in navigator)) return toast("error", t.discover.noLocation);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setF((x) => ({ ...x, lat: Math.round(p.coords.latitude * 100) / 100, lng: Math.round(p.coords.longitude * 100) / 100 }));
      },
      () => {
        setLocating(false);
        toast("error", t.discover.noLocation);
      },
      { timeout: 10_000 },
    );
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        exec(() => updateGroupSettings(groupId, f), { success: t.common.saved });
      }}
    >
      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl bg-surface-2 p-4">
        <span>
          <span className="block text-sm font-medium">{s.public}</span>
          <span className="mt-0.5 block text-xs text-muted">{s.publicDesc}</span>
        </span>
        <input type="checkbox" role="switch" className="mt-1 size-5 shrink-0 accent-[var(--ink)]" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} />
      </label>
      <label className="field">
        <span className="label">{t.community.group.description}</span>
        <textarea className="input min-h-20" maxLength={500} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span className="label">{s.category}</span>
          <select className="input" value={f.category ?? ""} onChange={(e) => setF({ ...f, category: (e.target.value || null) as Cat | null })}>
            <option value="">{t.common.none}</option>
            {CATS.map((c) => (
              <option key={c} value={c}>
                {t.community.categories[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{s.city}</span>
          <input className="input" maxLength={80} value={f.city} placeholder={s.cityPh} onChange={(e) => setF({ ...f, city: e.target.value })} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{f.lat != null ? s.locationSet : s.noCoords}</span>
        <button type="button" className="btn btn-soft btn-sm" onClick={locate} disabled={locating}>
          <LocateFixed className="size-4" aria-hidden /> {s.useLocation}
        </button>
        {f.lat != null && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, lat: null, lng: null })}>
            {s.clearLocation}
          </button>
        )}
      </div>
      <button className="btn btn-primary w-fit" disabled={pending}>
        {s.save}
      </button>
    </form>
  );
}

export function JoinRequests({ requests }: { requests: { id: string; message: string | null; createdAt: string; user: { name: string; image: string | null } }[] }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [list, setList] = useState(requests);
  const s = t.groupSettings;
  if (!list.length) return <p className="text-sm text-muted">{s.noRequests}</p>;
  const act = (id: string, approve: boolean) =>
    exec(() => reviewJoinRequest(id, approve), { success: approve ? s.approved : s.rejected, onSuccess: () => setList((xs) => xs.filter((x) => x.id !== id)) });
  return (
    <ul className="space-y-2">
      {list.map((r) => (
        <li key={r.id} className="rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={r.user.name} image={r.user.image} size={36} />
            <span className="min-w-0 flex-1 truncate font-medium">{r.user.name}</span>
            <button type="button" className="icon-btn size-9 bg-jade-soft text-jade-ink" disabled={pending} aria-label={`${s.approve}: ${r.user.name}`} title={s.approve} onClick={() => act(r.id, true)}>
              <Check className="size-4" aria-hidden />
            </button>
            <button type="button" className="icon-btn size-9 bg-surface" disabled={pending} aria-label={`${s.reject}: ${r.user.name}`} title={s.reject} onClick={() => act(r.id, false)}>
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {r.message && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">“{r.message}”</p>}
        </li>
      ))}
    </ul>
  );
}
