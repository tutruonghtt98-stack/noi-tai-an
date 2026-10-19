"use client";
import { useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { toggleFollow } from "@/actions/follow";
import { cn } from "@/lib/cn";

export function FollowButton({ userId, initial, size = "md" }: { userId: string; initial: boolean; size?: "sm" | "md" }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [following, setFollowing] = useState(initial);
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={following}
      disabled={pending}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => {
        const prev = following;
        setFollowing(!prev);
        exec(() => toggleFollow(userId), { onSuccess: (r) => setFollowing(r.following), onError: () => setFollowing(prev) });
      }}
      className={cn("btn", size === "sm" && "btn-sm", following ? "btn-soft" : "btn-primary")}
    >
      {following ? <UserCheck className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
      {following ? (hover ? t.follow.unfollow : t.follow.following) : t.follow.follow}
    </button>
  );
}
