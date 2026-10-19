"use client";
import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { loadFeed } from "@/actions/community";
import { Empty } from "@/components/ui/empty";
import type { PostView } from "@/lib/community";
import { PostCard } from "./post-card";

export function FeedList({
  initial,
  nextCursor,
  filter,
  isAdmin,
  emptyText,
}: {
  initial: PostView[];
  nextCursor: string | null;
  filter: { category?: string | null; groupId?: string | null; challengeId?: string | null; authorId?: string | null };
  isAdmin?: boolean;
  emptyText?: string;
}) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);

  // Server làm mới (sau khi đăng bài) → đồng bộ lại trang đầu
  useEffect(() => {
    setItems(initial);
    setCursor(nextCursor);
  }, [initial, nextCursor]);

  if (!items.length) return <Empty icon={MessagesSquare} text={emptyText ?? t.community.empty} />;

  return (
    <div className="grid grid-cols-1 gap-[var(--gap)]">
      {items.map((p) => (
        <PostCard key={p.id} post={p} isAdmin={isAdmin} onRemoved={(id) => setItems((xs) => xs.filter((x) => x.id !== id))} />
      ))}
      {cursor && (
        <button
          type="button"
          className="btn btn-soft mx-auto bg-surface shadow-card"
          disabled={pending}
          onClick={() =>
            exec(() => loadFeed({ cursor, ...filter }), {
              onSuccess: (res) => {
                setItems((xs) => [...xs, ...res.items]);
                setCursor(res.nextCursor);
              },
            })
          }
        >
          {pending ? t.common.loading : t.community.loadMore}
        </button>
      )}
    </div>
  );
}
