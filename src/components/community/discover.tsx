"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin, Search, Users, Clock, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { cancelJoinRequest, findGroups, requestJoin } from "@/actions/groups";
import { Modal } from "@/components/ui/modal";
import type { GroupCard } from "@/lib/group-discovery";
import { cn } from "@/lib/cn";

export function GroupCardView({ g, canRequest }: { g: GroupCard; canRequest: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [status, setStatus] = useState(g.status);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const d = t.discover;

  return (
    <article className="card rise flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {g.category && <span className="badge">{t.community.categories[g.category]}</span>}
        {g.city && (
          <span className="badge">
            <MapPin className="size-3" aria-hidden /> {g.city}
          </span>
        )}
        {g.distanceKm != null && <span className="badge bg-mist-soft text-mist-ink">{fmt(d.away, { d: g.distanceKm < 10 ? g.distanceKm.toFixed(1) : Math.round(g.distanceKm) })}</span>}
      </div>
      <h3 className="text-lg font-semibold leading-snug">{g.name}</h3>
      {g.description && <p className="line-clamp-2 text-sm text-ink-2">{g.description}</p>}
      {g.reasons.length > 0 && <p className="text-xs text-jade-ink">{g.reasons.map((r) => d.whySuggested[r]).join(" · ")}</p>}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="flex flex-col text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden /> {fmt(d.members, { n: g.members, max: g.maxMembers })}
          </span>
          {g.lastActiveDays != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> {g.lastActiveDays === 0 ? d.activeToday : fmt(d.active, { n: g.lastActiveDays })}
            </span>
          )}
        </span>
        {status === "member" ? (
          <Link href={`/community/groups/${g.id}`} className="btn btn-soft btn-sm">
            {t.common.seeAll}
          </Link>
        ) : status === "pending" ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => exec(() => cancelJoinRequest(g.id), { onSuccess: () => setStatus("open") })}>
            {d.cancelRequest}
          </button>
        ) : status === "full" ? (
          <span className="badge">{d.full}</span>
        ) : canRequest ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
            {d.requestJoin}
          </button>
        ) : (
          <Link href="/pricing" className="btn btn-soft btn-sm" title={d.proRequired}>
            <Lock className="size-3.5" aria-hidden /> {d.upgrade}
          </Link>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={`${d.requestJoin}: ${g.name}`}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => requestJoin(g.id, msg), {
              success: d.requestSent,
              onSuccess: () => {
                setStatus("pending");
                setOpen(false);
                router.refresh();
              },
            });
          }}
        >
          <label className="field">
            <span className="label">{d.requestMsg}</span>
            <textarea className="input" maxLength={300} value={msg} placeholder={d.requestMsgPh} onChange={(e) => setMsg(e.target.value)} autoFocus />
          </label>
          <button className="btn btn-primary" disabled={pending}>
            {d.requestJoin}
          </button>
        </form>
      </Modal>
    </article>
  );
}

const RADII = [5, 10, 25, 50];

export function DiscoverPanel({ canRequest }: { canRequest: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const { exec, pending } = useAction();
  const d = t.discover;
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState(10);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [results, setResults] = useState<GroupCard[] | null>(null);

  const search = (c = coords, r = radius) => exec(() => findGroups({ q, lat: c?.lat ?? null, lng: c?.lng ?? null, radiusKm: r }), { onSuccess: setResults });

  const near = () => {
    if (!("geolocation" in navigator)) return toast("error", d.noLocation);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        search(c);
      },
      () => {
        setLocating(false);
        toast("error", d.noLocation);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  return (
    <section className="card" aria-labelledby="discover">
      <h2 id="discover" className="card-title mb-4">
        {d.title}
      </h2>
      <form
        role="search"
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <label htmlFor="gq" className="sr-only">
          {d.searchPh}
        </label>
        <input id="gq" className="input min-w-0 flex-1 basis-60" placeholder={d.searchPh} value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
        <button className="icon-btn bg-ink text-bg hover:bg-ink hover:text-bg" aria-label={d.title} disabled={pending}>
          <Search className="size-4" aria-hidden />
        </button>
        <button type="button" className={cn("btn", coords ? "btn-primary" : "btn-soft")} onClick={near} disabled={locating}>
          <LocateFixed className={cn("size-4", locating && "animate-spin")} aria-hidden /> {locating ? d.locating : d.near}
        </button>
      </form>
      {coords && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{d.radius}:</span>
          <div className="segmented">
            {RADII.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={radius === r}
                onClick={() => {
                  setRadius(r);
                  search(coords, r);
                }}
              >
                {fmt(d.km, { n: r })}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setCoords(null), setResults(null))}>
            {t.common.close}
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">{d.locationPrivacy}</p>
      {results && (
        <div className="mt-5">
          <p className="mb-3 text-sm text-muted" role="status">
            {results.length ? fmt(d.results, { n: results.length }) : d.noResults}
          </p>
          <div className="grid grid-cols-1 gap-[var(--gap)] sm:grid-cols-2 xl:grid-cols-3">
            {results.map((g) => (
              <GroupCardView key={g.id} g={g} canRequest={canRequest} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
