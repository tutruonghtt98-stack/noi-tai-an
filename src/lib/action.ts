import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { PlanLimitError } from "@/lib/plan";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export class UserError extends Error {}

/**
 * Bọc server action: trả về lỗi có cấu trúc thay vì ném lỗi ra client.
 * Mã lỗi: VALIDATION · PLAN_LIMIT:<limit> · NOT_FOUND · <mã UserError> · ERROR
 */
export async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    unstable_rethrow(e); // để redirect()/notFound() hoạt động bình thường
    if (e instanceof PlanLimitError) return { ok: false, error: e.message };
    if (e instanceof ZodError) return { ok: false, error: "VALIDATION" };
    if (e instanceof UserError) return { ok: false, error: e.message };
    console.error("[action]", e);
    return { ok: false, error: "ERROR" };
  }
}
