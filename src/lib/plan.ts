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

export class PlanLimitError extends Error {
  constructor(public readonly limit: "activeGoals" | "habits") {
    super(`PLAN_LIMIT:${limit}`);
  }
}
