"use client";
import { useCallback, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { useToast } from "@/components/ui/toast";
import { PLAN_LIMITS } from "@/lib/plan";
import type { Result } from "@/lib/action";

/** Chạy server action trong transition, tự hiện toast khi lỗi. */
export function useAction() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const { t } = useI18n();

  const message = useCallback(
    (code: string) => {
      if (code === "PLAN_LIMIT:activeGoals") return fmt(t.common.planLimitGoals, { n: PLAN_LIMITS.FREE.activeGoals });
      if (code === "PLAN_LIMIT:habits") return fmt(t.common.planLimitHabits, { n: PLAN_LIMITS.FREE.habits });
      if (code === "PRIORITY_FULL") return t.today.priorityFull;
      if (code === "RATE_LIMIT") return t.community.rateLimit;
      if (code === "BAD_IMAGE") return t.community.imageTooLarge;
      if (code === "USERNAME_TAKEN") return t.community.profile.usernameTaken;
      if (code === "GROUP_FULL") return t.community.group.full;
      if (code === "ALREADY_MEMBER") return t.community.group.already;
      if (code === "GROUP_LIMIT") return t.community.group.limit;
      if (code === "PRO_ONLY") return t.community.challenge.proOnly;
      if (code === "PRO_ONLY_GROUP") return t.discover.proRequired;
      if (code === "NOT_STARTED") return t.community.challenge.notStarted;
      if (code === "ENDED") return t.community.challenge.over;
      return t.common.error;
    },
    [t],
  );

  const exec = useCallback(
    <T,>(fn: () => Promise<Result<T>>, opts?: { success?: string; onSuccess?: (data: T) => void; onError?: (code: string) => void }) => {
      start(async () => {
        const res = await fn();
        if (res.ok) {
          if (opts?.success) toast("success", opts.success);
          opts?.onSuccess?.(res.data);
        } else {
          toast("error", message(res.error));
          opts?.onError?.(res.error);
        }
      });
    },
    [toast, message],
  );

  return { pending, exec };
}
