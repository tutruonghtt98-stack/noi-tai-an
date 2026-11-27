import type { Plan, User } from "@/generated/prisma/client";

export const PLAN_LIMITS = {
  FREE: { activeGoals: 3, habits: 5, analyticsDays: 7, createChallenges: false, joinPublicGroups: false },
  PRO: { activeGoals: Infinity, habits: Infinity, analyticsDays: 3650, createChallenges: true, joinPublicGroups: true },
  TEAM: { activeGoals: Infinity, habits: Infinity, analyticsDays: 3650, createChallenges: true, joinPublicGroups: true },
} as const satisfies Record<Plan, unknown>;

/** Gói thực tế: gói trả phí hết hạn sẽ quay về FREE. */
export function effectivePlan(user: Pick<User, "plan" | "planExpiresAt">): Plan {
  if (user.plan === "FREE") return "FREE";
  if (user.planExpiresAt && user.planExpiresAt.getTime() < Date.now()) return "FREE";
  return user.plan;
}

export function limitsFor(user: Pick<User, "plan" | "planExpiresAt">) {
  return PLAN_LIMITS[effectivePlan(user)];
}

/**
 * Từ ngày ra mắt gói trả phí bắt buộc (dùng thử 7 ngày rồi phải mua Pro), app
 * không còn gói Free vĩnh viễn. Tài khoản tạo TRƯỚC mốc này được giữ nguyên
 * quyền truy cập như cũ (không bị khoá hồi tố) — chỉ tài khoản mới từ đây trở
 * đi mới áp dụng dùng thử 7 ngày + bắt buộc thanh toán sau đó.
 */
export const PAYWALL_LAUNCH_AT = new Date("2026-11-27T00:00:00Z");

/** Còn quyền dùng đầy đủ app: tài khoản cũ (trước paywall), đang dùng thử, hoặc đã mua Pro còn hạn. */
export function hasActiveAccess(user: Pick<User, "plan" | "planExpiresAt" | "trialEndsAt" | "createdAt">): boolean {
  if (user.createdAt < PAYWALL_LAUNCH_AT) return true;
  if (user.trialEndsAt && user.trialEndsAt.getTime() > Date.now()) return true;
  return effectivePlan(user) !== "FREE";
}

export class PlanLimitError extends Error {
  constructor(public readonly limit: "activeGoals" | "habits") {
    super(`PLAN_LIMIT:${limit}`);
  }
}
