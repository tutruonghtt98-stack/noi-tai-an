"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { HandHeart, MessageCircle, MoreHorizontal, Flag, Trash2, Trophy, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { useAction } from "@/lib/use-action";
import { addComment, deleteComment, deletePost, listComments, reportContent, toggleCheer } from "@/actions/community";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import type { PostView } from "@/lib/community";
import { cn } from "@/lib/cn";

const CAT_COLOR: Record<string, string> = { READING: "ochre", WORKOUT: "jade", STUDY: "mist", FOCUS: "mist", GOAL: "rose", OTHER: "" };

export function useTimeAgo() {
  const { t } = useI18n();
  return (iso: string) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return t.community.justNow;
    if (s < 3600) return fmt(t.community.minutesAgo, { n: Math.floor(s / 60) });
    if (s < 86400) return fmt(t.community.hoursAgo, { n: Math.floor(s / 3600) });
    return fmt(t.community.daysAgo, { n: Math.floor(s / 86400) });
  };
}

type Comment = { id: string; content: string; createdAt: string; mine: boolean; author: { name: string; image: string | null } };

export function PostCard({ post, isAdmin, onRemoved }: { post: PostView; isAdmin?: boolean; onRemoved?: (id: string) => void }) {
  const { t } = useI18n();
  const ago = useTimeAgo();
  const { exec, pending } = useAction();
  const [cheer, setCheer] = useState({ on: post.cheered, n: post.cheerCount });
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState(t.community.reportReasons[0]!);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [draft, setDraft] = useState("");
  const color = CAT_COLOR[post.category];

  const loadComments = () =>
    exec(() => listComments(post.id), { onSuccess: (rows) => setComments(rows) });

  const toggleComments = () => (comments ? setComments(null) : loadComments());

  const AuthorName = post.author.username ? (
    <Link href={`/u/${post.author.username}`} className="font-semibold hover:underline">
      {post.author.name}
    </Link>
  ) : (
    <span className="font-semibold">{post.author.name}</span>
  );

  return (
    <article className="card rise p-5 sm:p-6">
      <header className="flex items-start gap-3">
        <Avatar name={post.author.name} image={post.author.image} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate">{AuthorName}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <time dateTime={post.createdAt}>{ago(post.createdAt)}</time>
            <span
              className="badge"
              style={color ? { background: `var(--${color}-soft)`, color: `var(--${color}-ink)` } : undefined}
            >
              {post.kind === "SUMMARY" ? t.community.group.summary : t.community.categories[post.category as "OTHER"]}
            </span>
            {post.challenge && (
              <Link href={`/community/challenges/${post.challenge.id}`} className="inline-flex items-center gap-1 hover:text-ink">
                <Trophy className="size-3.5" aria-hidden /> {post.challenge.title}
              </Link>
            )}
          </p>
        </div>
        <div className="relative">
          <button type="button" className="icon-btn icon-btn-plain -mr-2" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 top-11 z-20 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-pop" onMouseLeave={() => setMenu(false)}>
              {!post.mine && (
                <button role="menuitem" type="button" className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm hover:bg-surface-2" onClick={() => (setMenu(false), setReporting(true))}>
                  <Flag className="size-4" aria-hidden /> {t.community.report}
                </button>
              )}
              {(post.mine || isAdmin) && (
                <button
                  role="menuitem"
                  type="button"
                  className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-danger hover:bg-surface-2"
                  onClick={() => {
                    setMenu(false);
                    if (confirm(t.common.confirmDelete)) exec(() => deletePost(post.id), { onSuccess: () => onRemoved?.(post.id) });
                  }}
                >
                  <Trash2 className="size-4" aria-hidden /> {t.community.deletePost}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <p className="mt-4 whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>
      {post.imageUrl && (
        <img src={post.imageUrl} alt="" loading="lazy" decoding="async" className="mt-4 max-h-[520px] w-full rounded-2xl bg-surface-2 object-cover" />
      )}

      <footer className="mt-4 flex items-center gap-2 border-t border-line pt-3">
        <button
          type="button"
          aria-pressed={cheer.on}
          onClick={() => {
            const prev = cheer;
            setCheer({ on: !prev.on, n: prev.n + (prev.on ? -1 : 1) });
            exec(() => toggleCheer(post.id), {
              onSuccess: (r) => setCheer({ on: r.cheered, n: prev.n + (r.cheered === prev.on ? 0 : r.cheered ? 1 : -1) }),
              onError: () => setCheer(prev),
            });
          }}
          className={cn("btn btn-sm", cheer.on ? "bg-rose-soft text-rose-ink" : "btn-ghost")}
        >
          <HandHeart className={cn("size-4", cheer.on && "fill-current")} aria-hidden />
          {cheer.n > 0 ? fmt(t.community.cheers, { n: cheer.n }) : t.community.cheer}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggleComments} aria-expanded={!!comments}>
          <MessageCircle className="size-4" aria-hidden />
          {commentCount > 0 ? fmt(t.community.comments, { n: commentCount }) : t.community.comment}
        </button>
      </footer>

      {comments && (
        <div className="mt-3 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="group flex gap-2.5">
              <Avatar name={c.author.name} image={c.author.image} size={32} />
              <div className="min-w-0 flex-1 rounded-2xl bg-surface-2 px-3.5 py-2">
                <p className="text-sm font-semibold">
                  {c.author.name} <span className="font-normal text-muted">· {ago(c.createdAt)}</span>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">{c.content}</p>
              </div>
              {(c.mine || isAdmin) && (
                <button
                  type="button"
                  className="icon-btn icon-btn-plain size-9 self-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={t.common.delete}
                  onClick={() =>
                    exec(() => deleteComment(c.id), {
                      onSuccess: () => {
                        setComments((cs) => cs?.filter((x) => x.id !== c.id) ?? null);
                        setCommentCount((n) => n - 1);
                      },
                    })
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </div>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              exec(() => addComment(post.id, draft), {
                onSuccess: () => {
                  setDraft("");
                  setCommentCount((n) => n + 1);
                  loadComments();
                },
              });
            }}
          >
            <label htmlFor={`c-${post.id}`} className="sr-only">
              {t.community.commentPh}
            </label>
            <input id={`c-${post.id}`} className="input" maxLength={1000} placeholder={t.community.commentPh} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="icon-btn bg-ink text-bg hover:bg-ink hover:text-bg" disabled={pending || !draft.trim()} aria-label={t.community.send}>
              <Send className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      )}

      <Modal open={reporting} onClose={() => setReporting(false)} title={t.community.report}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            exec(() => reportContent({ postId: post.id, reason }), { success: t.community.reported, onSuccess: () => setReporting(false) });
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="label mb-2">{t.community.reportReason}</legend>
            {t.community.reportReasons.map((r) => (
              <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-4">
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--ink)]" />
                {r}
              </label>
            ))}
          </fieldset>
          <button className="btn btn-primary" disabled={pending}>
            {t.community.report}
          </button>
        </form>
      </Modal>
    </article>
  );
}
